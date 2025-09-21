// controllers/symposiumPaymentController.js
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const Payment = require("../models/Payment");
const User = require("../models/User");

const FEE = Number(process.env.PAYMENT_FEE_INR || 250);
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

function ok(res, status, payload){ return res.status(status).json({ success: true, ...payload }); }
function fail(res, status, message){ return res.status(status).json({ success: false, message }); }

// GET /api/v1/symposium/status?emails=alice@example.com,bob@example.com
exports.status = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");
    const raw = (req.query.emails || "").trim();
    const list = raw ? raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean) : [];
    const includeSelf = new Set([ (req.user.email||"").toLowerCase(), ...list ]);
    const emails = Array.from(includeSelf);

    const users = await User.find({ email: { $in: emails } }).select("email hasPaidSymposium");
    const map = new Map(users.map(u => [u.email.toLowerCase(), u.hasPaidSymposium]));
    const result = emails.map(e => ({ email: e, hasPaid: !!map.get(e) }));
    return ok(res, 200, { entries: result });
  } catch (err) { next(err); }
};

// POST /api/v1/symposium/order
// Body: { emails?: string[] }  // optional extra emails besides the caller
exports.createOrder = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");

    const leaderEmail = (req.user.email || "").toLowerCase();
    const extra = (req.body?.emails || []).map(e => String(e||"").toLowerCase());
    const emails = Array.from(new Set([leaderEmail, ...extra].filter(Boolean)));

    // Who still hasn't paid?
    const users = await User.find({ email: { $in: emails } }).select("email hasPaidSymposium");
    const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
    const unpaid = emails.filter(e => !(byEmail.get(e)?.hasPaidSymposium));
    const count = unpaid.length;

    if (count === 0) {
      return ok(res, 200, { message: "Everyone already paid", payment: { needsPayment: false } });
    }

    const amountPaise = count * FEE * 100;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `sym_${req.user._id}_${Date.now()}`,
      notes: { leader: leaderEmail, emails: unpaid.join(","), count: String(count) }
    });

    await Payment.create({
      user: req.user._id,
      registration: null,
      kind: "symposium",
      memberEmails: unpaid,
      amount: amountPaise,
      currency: "INR",
      orderId: order.id,
      status: "created"
    });

    return ok(res, 201, {
      payment: {
        needsPayment: true,
        keyId: process.env.RAZORPAY_KEY_ID,
        order: { id: order.id, amount: order.amount, currency: order.currency }
      }
    });
  } catch (err) { next(err); }
};

// POST /api/v1/symposium/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
exports.verify = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return fail(res, 400, "razorpay_order_id, razorpay_payment_id, razorpay_signature required");
    }

    // Verify signature
    const signBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", KEY_SECRET).update(signBody).digest("hex");
    if (expected !== razorpay_signature) return fail(res, 400, "Invalid payment signature");

    // Find payment doc
    const p = await Payment.findOne({ orderId: razorpay_order_id, kind: "symposium" });
    if (!p) return fail(res, 404, "Payment order not found");

    if (p.status === "paid") {
      // Idempotent
      const already = await User.find({ email: { $in: p.memberEmails } }).select("email hasPaidSymposium");
      return ok(res, 200, { message: "Already verified", covered: already });
    }

    // Mark paid
    p.status = "paid";
    p.paymentId = razorpay_payment_id;
    await p.save();

    // Flag all covered emails as paid-for-symposium
    if (p.memberEmails?.length) {
      await User.updateMany(
        { email: { $in: p.memberEmails } },
        { $set: { hasPaidSymposium: true, symposiumPaidAt: new Date() } }
      );
    }

    const covered = await User.find({ email: { $in: p.memberEmails } }).select("email hasPaidSymposium");
    return ok(res, 200, { covered });
  } catch (err) { next(err); }
};
