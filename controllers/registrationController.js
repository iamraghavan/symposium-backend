const Registration = require("../models/Registration");
const User = require("../models/User");
const Payment = require("../models/Payment");
const razorpay = require("../config/razorpay");

const FEE = Number(process.env.PAYMENT_FEE_INR || 250);

// Collect all emails that must have paid at least once
function uniqueEmailsFromRegistration(reg) {
  if (reg.type === "individual") return [reg.userEmail].filter(Boolean);
  const memberEmails = (reg.team?.members || []).map(m => m.email).filter(Boolean);
  const owner = reg.userEmail ? [reg.userEmail] : [];
  return Array.from(new Set([...owner, ...memberEmails]));
}

/**
 * Create registration:
 * - If every person (individual or team members + leader) has already paid once → FREE & auto-confirmed
 * - Else create a Razorpay Order for only the UNPAID persons (₹250 each)
 * - No manual verification anywhere; webhook will confirm and mark users paid-for-life
 */
exports.create = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { eventId, type, team, notes } = req.body;
    if (!eventId || !type) return res.status(400).json({ success: false, message: "eventId and type are required" });

    const leader = await User.findById(req.user._id);
    if (!leader) return res.status(404).json({ success: false, message: "User not found" });

    // Create the registration (unique index on (event,user,status) prevents dup active regs)
    const reg = await Registration.create({
      event: eventId,
      user: leader._id,
      type,
      team: type === "team" ? (team || {}) : undefined,
      notes,
      eventName: req.body.eventName || undefined,
      userEmail: leader.email,
      status: "pending",
      payment: { method: "gateway", status: "none", currency: "INR", amount: 0, gatewayProvider: "razorpay" }
    });

    // Determine who still needs to pay the one-time fee
    const emails = uniqueEmailsFromRegistration(reg);
    const usersByEmail = await User.find({ email: { $in: emails } }).select("_id email hasPaidEventFee");
    const byEmail = new Map(usersByEmail.map(u => [u.email, u]));
    const unpaidEmails = emails.filter(e => !(byEmail.get(e)?.hasPaidEventFee));
    const toChargeCount = unpaidEmails.length;

    if (toChargeCount === 0) {
      // Everyone covered already → free, instant confirm
      reg.payment.status = "paid";
      reg.payment.amount = 0;
      reg.status = "confirmed";
      await reg.save();

      return res.status(201).json({
        success: true,
        registration: reg,
        payment: { required: false }
      });
    }

    // Charge only the people who have never paid before
    const amountPaise = FEE * 100 * toChargeCount;

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `reg_${reg._id}_${Date.now()}`,
      notes: {
        registrationId: String(reg._id),
        leaderEmail: leader.email,
        unpaidCount: String(toChargeCount)
      }
    });

    await Payment.create({
      user: leader._id,
      registration: reg._id,
      memberEmails: unpaidEmails,
      amount: amountPaise,
      currency: "INR",
      orderId: order.id,
      status: "created"
    });

    reg.payment.status = "pending";
    reg.payment.amount = amountPaise / 100; // in INR for display
    reg.payment.gatewayOrderId = order.id;
    await reg.save();

    return res.status(201).json({
      success: true,
      registration: reg,
      payment: {
        required: true,
        provider: "razorpay",
        keyId: process.env.RAZORPAY_KEY_ID,
        order: { id: order.id, amount: order.amount, currency: order.currency }
      }
    });
  } catch (err) {
    // Handle duplicate active registration nicely
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "You already have an active registration for this event." });
    }
    next(err);
  }
};

exports.listMine = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
    const regs = await Registration.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, items: regs });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: "Registration not found" });

    const isOwner = String(reg.user) === String(req.user?._id);
    const isAdmin = ["super_admin", "department_admin"].includes(req.user?.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    res.json({ success: true, registration: reg });
  } catch (err) { next(err); }
};

// QR/manual payment is removed entirely.
// No adminVerifyPayment anymore (all automatic via webhook).
