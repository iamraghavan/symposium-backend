// controllers/registrationController.js
const Registration = require("../models/Registration");
const User = require("../models/User");
const Payment = require("../models/Payment");
const razorpay = require("../config/razorpay");

const FEE = Number(process.env.PAYMENT_FEE_INR || 250);

// gather unique emails that must be covered by the one-time fee
function uniqueEmailsFromRegistrationDraft({ type, leaderEmail, team }) {
  if (type === "individual") return [leaderEmail];
  const members = (team?.members || []).map(m => (m.email || "").toLowerCase());
  return Array.from(new Set([leaderEmail.toLowerCase(), ...members].filter(Boolean)));
}

function ok(res, status, payload) {
  return res.status(status).json({ success: true, ...payload });
}
function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

/**
 * POST /api/v1/registrations
 * Idempotent per (eventId, userId) for active statuses.
 * - If all covered people have already paid once => confirm free
 * - Else create/return Razorpay order for only UNPAID people (₹250 each)
 * Response always includes the registration. If payment needed, includes hints. 
 */
exports.create = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");

    const { eventId, type, team, notes, eventName } = req.body || {};
    if (!eventId || !type) return fail(res, 400, "eventId and type are required");

    const leader = await User.findById(req.user._id);
    if (!leader) return fail(res, 404, "User not found");

    // 1) Idempotency: if there is an active registration, return it
    let existing = await Registration.findOne({
      event: eventId,
      user: leader._id,
      status: { $in: ["pending", "confirmed"] }
    });

    if (existing) {
      // If pending with an order, return order hints; if confirmed, just return it
      const hints = (existing.payment?.status === "pending" && existing.payment?.gatewayOrderId)
        ? { razorpayOrderId: existing.payment.gatewayOrderId, amountPaise: (existing.payment.amount * 100) }
        : undefined;

      return ok(res, 200, { registration: existing, hints });
    }

    // 2) Create a fresh registration in PENDING
    let reg = await Registration.create({
      event: eventId,
      user: leader._id,
      type,
      team: type === "team" ? (team || {}) : undefined,
      notes,
      eventName: eventName || undefined,
      userEmail: leader.email,
      status: "pending",
      payment: {
        method: "gateway",
        status: "none",
        currency: "INR",
        amount: 0,
        gatewayProvider: "razorpay",
        history: []
      }
    });

    // 3) Decide who still needs to pay the one-time fee
    const emails = uniqueEmailsFromRegistrationDraft({
      type,
      leaderEmail: leader.email,
      team
    });

    const users = await User.find({ email: { $in: emails } }).select("email hasPaidEventFee");
    const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
    const unpaidEmails = emails.filter(e => !(byEmail.get(e)?.hasPaidEventFee));
    const toChargeCount = unpaidEmails.length;

    if (toChargeCount === 0) {
      // Everyone already paid -> free + confirmed
      reg.payment.status = "paid";
      reg.payment.amount = 0;
      reg.status = "confirmed";
      reg.payment.history.push({ kind: "order_created", data: { amountPaise: 0, reason: "all_paid" } });
      await reg.save();

      return ok(res, 201, { registration: reg });
    }

    // 4) Create Razorpay order only for unpaid people
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

    // track a Payment doc (one order per create)
    await Payment.create({
      user: leader._id,
      registration: reg._id,
      memberEmails: unpaidEmails,
      amount: amountPaise,
      currency: "INR",
      orderId: order.id,
      status: "created"
    });

    // persist payment summary on registration
    reg.payment.status = "pending";
    reg.payment.amount = amountPaise / 100; // in INR for display
    reg.payment.gatewayOrderId = order.id;
    reg.payment.history.push({
      kind: "order_created",
      data: { orderId: order.id, amountPaise, unpaidEmails }
    });
    await reg.save();

    return ok(res, 201, {
      registration: reg,
      hints: {
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        razorpayOrderId: order.id,
        amountPaise: order.amount,
        currency: order.currency
      }
    });
  } catch (err) {
    // duplicate-key safety (unique index on active reg)
    if (err?.code === 11000) {
      try {
        const leaderId = req.user?._id;
        const again = await Registration.findOne({
          event: req.body.eventId,
          user: leaderId,
          status: { $in: ["pending", "confirmed"] }
        });
        if (again) {
          const hints = (again.payment?.status === "pending" && again.payment?.gatewayOrderId)
            ? { razorpayOrderId: again.payment.gatewayOrderId, amountPaise: again.payment.amount * 100 }
            : undefined;
          return ok(res, 200, { registration: again, hints });
        }
      } catch (_) {}
      return fail(res, 409, "You already have an active registration for this event.");
    }
    next(err);
  }
};

/**
 * Optional: client can acknowledge checkout success (for analytics/audit only).
 * Does NOT mark paid; webhook remains the source of truth.
 * POST /api/v1/registrations/:id/checkout-ack
 */
exports.checkoutAck = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");
    const { id } = req.params;
    const { orderId, paymentId, signature, notes } = req.body || {};

    const reg = await Registration.findById(id);
    if (!reg) return fail(res, 404, "Registration not found");
    if (String(reg.user) !== String(req.user._id)) return fail(res, 403, "Forbidden");

    // store but don't trust
    reg.payment.history.push({
      kind: "checkout_ack",
      data: { orderId, paymentId, signature, notes }
    });
    await reg.save();

    return ok(res, 200, { registration: reg });
  } catch (err) { next(err); }
};

exports.listMine = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");
    const regs = await Registration.find({ user: req.user._id }).sort({ createdAt: -1 });
    return ok(res, 200, { items: regs });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return fail(res, 404, "Registration not found");

    const isOwner = String(reg.user) === String(req.user?._id);
    const isAdmin = ["super_admin", "department_admin"].includes(req.user?.role);
    if (!isOwner && !isAdmin) return fail(res, 403, "Forbidden");

    return ok(res, 200, { registration: reg });
  } catch (err) { next(err); }
};
