const Registration = require("../models/Registration");
const User = require("../models/User");

const FEE = Number(process.env.PAYMENT_FEE_INR || 250);

function uniqueEmailsFromDraft({ type, leaderEmail, team }) {
  if (type === "individual") return [String(leaderEmail || "").toLowerCase()].filter(Boolean);
  const members = (team?.members || []).map(m => String(m.email || "").toLowerCase());
  return Array.from(new Set([String(leaderEmail || "").toLowerCase(), ...members].filter(Boolean)));
}

function ok(res, status, payload) { return res.status(status).json({ success: true, ...payload }); }
function fail(res, status, message) { return res.status(status).json({ success: false, message }); }

/**
 * POST /api/v1/registrations
 * Idempotent per (eventId, userId, status in ["pending","confirmed"])
 * Does NOT create a Razorpay order; frontend calls /api/v1/order if needed.
 */
exports.create = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");

    const { eventId, type, team, notes, eventName } = req.body || {};
    if (!eventId || !type) return fail(res, 400, "eventId and type are required");

    const leader = await User.findById(req.user._id);
    if (!leader) return fail(res, 404, "User not found");

    // 1) Idempotency: return active registration if exists
    let existing = await Registration.findOne({
      event: eventId,
      user: leader._id,
      status: { $in: ["pending", "confirmed"] }
    });

    if (existing) {
      // compute unpaid (at this moment) to inform FE
      const emails = uniqueEmailsFromDraft({ type: existing.type, leaderEmail: existing.userEmail, team: existing.team });
      const users = await User.find({ email: { $in: emails } }).select("email hasPaidEventFee");
      const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
      const unpaidEmails = emails.filter(e => !(byEmail.get(e)?.hasPaidEventFee));
      const unpaidCount = unpaidEmails.length;

      return ok(res, 200, {
        registration: existing,
        payment: {
          needsPayment: unpaidCount > 0,
          feeInInr: FEE,
          unpaidCount
        }
      });
    }

    // 2) Create fresh registration
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

    // 3) Decide who owes the one-time fee
    const emails = uniqueEmailsFromDraft({ type, leaderEmail: leader.email, team });
    const users = await User.find({ email: { $in: emails } }).select("email hasPaidEventFee");
    const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
    const unpaidEmails = emails.filter(e => !(byEmail.get(e)?.hasPaidEventFee));
    const toChargeCount = unpaidEmails.length;

    if (toChargeCount === 0) {
      reg.payment.status = "paid";
      reg.payment.amount = 0;
      reg.status = "confirmed";
      reg.payment.history.push({ kind: "order_created", data: { amountPaise: 0, reason: "all_paid" } });
      await reg.save();
      return ok(res, 201, { registration: reg, payment: { needsPayment: false, feeInInr: FEE, unpaidCount: 0 } });
    }

    // Don't create order here; frontend will call /api/v1/order
    reg.payment.status = "none";
    await reg.save();

    return ok(res, 201, {
      registration: reg,
      payment: {
        needsPayment: true,
        feeInInr: FEE,
        unpaidCount: toChargeCount
      }
    });
  } catch (err) {
    if (err?.code === 11000) {
      return fail(res, 409, "You already have an active registration for this event.");
    }
    next(err);
  }
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

// Optional analytics endpoint kept; does not change state
exports.checkoutAck = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");
    const { id } = req.params;
    const { orderId, paymentId, signature, notes } = req.body || {};
    const reg = await Registration.findById(id);
    if (!reg) return fail(res, 404, "Registration not found");
    if (String(reg.user) !== String(req.user._id)) return fail(res, 403, "Forbidden");

    reg.payment.history.push({ kind: "checkout_ack", data: { orderId, paymentId, signature, notes } });
    await reg.save();
    return ok(res, 200, { registration: reg });
  } catch (err) { next(err); }
};
