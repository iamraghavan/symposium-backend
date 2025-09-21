const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const Payment = require("../models/Payment");
const Registration = require("../models/Registration");
const User = require("../models/User");

const FEE = Number(process.env.PAYMENT_FEE_INR || 250);
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// helper to re-check who is unpaid right now for a registration
async function computeUnpaidEmailsForRegistration(reg) {
  const leaderEmail = String(reg.userEmail || "").toLowerCase();
  const type = reg.type;
  const team = reg.team;
  const emails = (type === "individual")
    ? [leaderEmail].filter(Boolean)
    : Array.from(new Set([leaderEmail, ...(team?.members || []).map(m => String(m.email || "").toLowerCase())].filter(Boolean)));
  const users = await User.find({ email: { $in: emails } }).select("email hasPaidEventFee");
  const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
  return emails.filter(e => !(byEmail.get(e)?.hasPaidEventFee));
}

/**
 * POST /api/v1/order
 * Body: { registrationId: string }
 * Creates a Razorpay order for ONLY the users who still haven't paid once.
 */
exports.createOrder = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { registrationId } = req.body || {};
    if (!registrationId) return res.status(400).json({ success: false, message: "registrationId is required" });

    const reg = await Registration.findById(registrationId);
    if (!reg) return res.status(404).json({ success: false, message: "Registration not found" });
    if (String(reg.user) !== String(req.user._id)) return res.status(403).json({ success: false, message: "Forbidden" });
    if (reg.status === "confirmed") {
      return res.status(200).json({ success: true, message: "Already confirmed", registration: reg, payment: { needsPayment: false } });
    }

    const unpaidEmails = await computeUnpaidEmailsForRegistration(reg);
    const count = unpaidEmails.length;

    if (count === 0) {
      // Nothing to pay -> confirm now
      reg.payment.status = "paid";
      reg.payment.amount = 0;
      reg.status = "confirmed";
      reg.payment.history.push({ kind: "order_created", data: { amountPaise: 0, reason: "all_paid" } });
      await reg.save();
      return res.status(200).json({ success: true, registration: reg, payment: { needsPayment: false } });
    }

    // Idempotency: if an unpaid order already exists and is not paid, reuse it
    if (reg.payment.status === "pending" && reg.payment.gatewayOrderId) {
      return res.status(200).json({
        success: true,
        registration: reg,
        payment: {
          needsPayment: true,
          keyId: process.env.RAZORPAY_KEY_ID,
          order: { id: reg.payment.gatewayOrderId, amount: reg.payment.amount * 100, currency: "INR" }
        }
      });
    }

    const amountPaise = FEE * 100 * count;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `reg_${reg._id}_${Date.now()}`,
      notes: { registrationId: String(reg._id), unpaidCount: String(count) }
    });

    // Track a payment doc
    await Payment.create({
      user: reg.user,
      registration: reg._id,
      memberEmails: unpaidEmails,
      amount: amountPaise,
      currency: "INR",
      orderId: order.id,
      status: "created"
    });

    // Update registration payment summary
    reg.payment.status = "pending";
    reg.payment.amount = amountPaise / 100;
    reg.payment.gatewayOrderId = order.id;
    reg.payment.history.push({ kind: "order_created", data: { orderId: order.id, amountPaise, unpaidEmails } });
    await reg.save();

    return res.status(201).json({
      success: true,
      registration: reg,
      payment: {
        needsPayment: true,
        keyId: process.env.RAZORPAY_KEY_ID,
        order: { id: order.id, amount: order.amount, currency: order.currency }
      }
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/verify
 * Body: { registrationId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Verifies the checkout signature and finalizes the registration.
 */
exports.verify = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { registrationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!registrationId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "registrationId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required" });
    }

    const reg = await Registration.findById(registrationId);
    if (!reg) return res.status(404).json({ success: false, message: "Registration not found" });
    if (String(reg.user) !== String(req.user._id)) return res.status(403).json({ success: false, message: "Forbidden" });

    // If already confirmed, be idempotent
    if (reg.status === "confirmed") {
      return res.status(200).json({ success: true, registration: reg, message: "Already confirmed" });
    }

    // Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", KEY_SECRET).update(body).digest("hex");
    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Find payment doc for this order
    const paymentDoc = await Payment.findOne({ orderId: razorpay_order_id });
    if (!paymentDoc) {
      return res.status(404).json({ success: false, message: "Payment order not found" });
    }
    if (paymentDoc.status === "paid") {
      // already processed (idempotent)
      const already = await Registration.findById(paymentDoc.registration);
      return res.status(200).json({ success: true, registration: already || reg, message: "Payment already verified" });
    }

    // Mark payment + registration
    paymentDoc.status = "paid";
    paymentDoc.paymentId = razorpay_payment_id;
    await paymentDoc.save();

    reg.payment.status = "paid";
    reg.payment.gatewayOrderId = razorpay_order_id;
    reg.payment.gatewayPaymentId = razorpay_payment_id;
    reg.payment.verifiedAt = new Date();
    reg.status = "confirmed";
    reg.payment.history.push({ kind: "webhook_paid", data: { orderId: razorpay_order_id, paymentId: razorpay_payment_id, via: "verify-endpoint" } });
    await reg.save();

    // Mark users covered by this payment as paid-for-life
    if (paymentDoc.memberEmails?.length) {
      await User.updateMany(
        { email: { $in: paymentDoc.memberEmails } },
        { $set: { hasPaidEventFee: true, eventFeePaidAt: new Date() } }
      );
    }

    return res.status(200).json({ success: true, registration: reg });
  } catch (err) { next(err); }
};
