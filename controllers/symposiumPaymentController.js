// controllers/symposiumPaymentController.js
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const Payment = require("../models/Payment");
const User = require("../models/User");

/* =========================
   Pricing & Config
   ========================= */
const FEE = Number(process.env.PAYMENT_FEE_INR || 250); // base symposium fee per person (INR)
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Pass Razorpay gateway fees to payer? (true = add to total)
const PASS_FEES = String(process.env.PASS_GATEWAY_FEES_TO_PAYER || "true").toLowerCase() === "true";

// Razorpay fee % (on base) and GST % (on that fee) — tune as needed
const RZP_FEE_RATE = Number(process.env.RZP_FEE_RATE || 0.02); // 2%
const GST_RATE     = Number(process.env.GST_RATE || 0.18);     // 18%

/* =========================
   Helpers
   ========================= */
function ok(res, status, payload){ return res.status(status).json({ success: true, ...payload }); }
function fail(res, status, message){ return res.status(status).json({ success: false, message }); }

function inPaise(inr) { return Math.round(Number(inr) * 100); }
function fromPaise(paise) { return Number(paise) / 100; }

/**
 * Compute per-head and totals for N attendees.
 * If PASS_FEES=false, base is charged; fee & GST are reported as 0 (absorbed by organizer).
 */
function computePricing(count) {
  const basePerHeadPaise = inPaise(FEE);  // e.g., 250 => 25000
  let rzpFeePerHeadPaise = 0;
  let gstPerHeadPaise = 0;

  if (PASS_FEES) {
    rzpFeePerHeadPaise = Math.round(basePerHeadPaise * RZP_FEE_RATE); // e.g., 25000 * 0.02 = 500
    gstPerHeadPaise    = Math.round(rzpFeePerHeadPaise * GST_RATE);   // e.g., 500 * 0.18 = 90
  }

  const totalPerHeadPaise = basePerHeadPaise + rzpFeePerHeadPaise + gstPerHeadPaise;

  const totals = {
    basePaise: basePerHeadPaise * count,
    rzpFeePaise: rzpFeePerHeadPaise * count,
    gstPaise: gstPerHeadPaise * count,
    totalPaise: totalPerHeadPaise * count
  };

  const perHead = {
    baseInr: fromPaise(basePerHeadPaise),
    rzpFeeInr: fromPaise(rzpFeePerHeadPaise),
    gstInr: fromPaise(gstPerHeadPaise),
    totalInr: fromPaise(totalPerHeadPaise)
  };

  return { perHead, totals };
}

/* =========================
   Controllers
   ========================= */

/**
 * GET /api/v1/symposium-payments/symposium/status?emails=a@x.com,b@y.com
 * - Always includes the caller (req.user.email) in the check.
 */
exports.status = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");

    const raw = (req.query.emails || "").trim();
    const extra = raw ? raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean) : [];
    const includeSelf = new Set([(req.user.email || "").toLowerCase(), ...extra]);
    const emails = Array.from(includeSelf);

    const users = await User.find({ email: { $in: emails } }).select("email hasPaidSymposium");
    const map = new Map(users.map(u => [u.email.toLowerCase(), u.hasPaidSymposium]));
    const result = emails.map(e => ({ email: e, hasPaid: !!map.get(e) }));

    return ok(res, 200, { entries: result });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/symposium-payments/symposium/order
 * Body: { emails?: string[] }  // optional list in addition to caller
 * - Creates a Razorpay order for all UNPAID people in the list (including caller).
 * - Adds fee+GST per head if PASS_FEES=true.
 */
exports.createOrder = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");

    const leaderEmail = (req.user.email || "").toLowerCase();
    const extra = (req.body?.emails || []).map(e => String(e||"").toLowerCase());
    const emails = Array.from(new Set([leaderEmail, ...extra].filter(Boolean)));

    // Determine unpaid set
    const users = await User.find({ email: { $in: emails } }).select("email hasPaidSymposium");
    const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
    const unpaid = emails.filter(e => !(byEmail.get(e)?.hasPaidSymposium));
    const count = unpaid.length;

    if (count === 0) {
      return ok(res, 200, { message: "Everyone already paid", payment: { needsPayment: false } });
    }

    // Compute pricing & build order
    const { perHead, totals } = computePricing(count);
    const amountPaise = totals.totalPaise;

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `sym_${req.user._id}_${Date.now()}`,
      notes: {
        leader: leaderEmail,
        emails: unpaid.join(","),
        count: String(count),
        baseInr_perHead: String(perHead.baseInr),
        rzpFeeInr_perHead: String(perHead.rzpFeeInr),
        gstInr_perHead: String(perHead.gstInr),
        totalInr_perHead: String(perHead.totalInr),
        passFees: String(PASS_FEES),
        feeRate: String(RZP_FEE_RATE),
        gstRate: String(GST_RATE)
      }
    });

    // Persist intent
    await Payment.create({
      user: req.user._id,
      registration: null,
      kind: "symposium",
      memberEmails: unpaid,
      amount: amountPaise,
      currency: "INR",
      orderId: order.id,
      status: "created",
      raw: {
        pricing: {
          count,
          perHead,
          totals: {
            baseInr: fromPaise(totals.basePaise),
            rzpFeeInr: fromPaise(totals.rzpFeePaise),
            gstInr: fromPaise(totals.gstPaise),
            totalInr: fromPaise(totals.totalPaise)
          },
          config: { PASS_FEES, RZP_FEE_RATE, GST_RATE }
        }
      }
    });

    return ok(res, 201, {
      payment: {
        needsPayment: true,
        keyId: process.env.RAZORPAY_KEY_ID,
        order: { id: order.id, amount: order.amount, currency: order.currency }
      },
      breakdown: {
        people: count,
        perHead,
        totals: {
          baseInr: fromPaise(totals.basePaise),
          rzpFeeInr: fromPaise(totals.rzpFeePaise),
          gstInr: fromPaise(totals.gstPaise),
          totalInr: fromPaise(totals.totalPaise)
        },
        notes: PASS_FEES
          ? "Razorpay fee + GST are added to the attendee."
          : "Organizer is absorbing Razorpay fee + GST."
      }
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/symposium-payments/symposium/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * - Verifies signature (order_id|payment_id).
 * - Marks Payment paid + persists raw; flags all covered users as hasPaidSymposium=true.
 * - Idempotent.
 */
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

    // Idempotency
    if (p.status === "paid") {
      const already = await User.find({ email: { $in: p.memberEmails } }).select("email hasPaidSymposium");
      return ok(res, 200, { message: "Already verified", covered: already });
    }

    // Mark paid + persist raw
    p.status = "paid";
    p.paymentId = razorpay_payment_id;
    p.raw = { source: "verify-endpoint", body: req.body };
    await p.save();

    // Flag users
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

/**
 * POST /api/v1/symposium-payments/symposium/update
 * Body: {
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string,
 *   amount?: number,     // paise (required only when Payment doc doesn't exist yet)
 *   currency?: "INR",
 *   emails?: string[],   // who this payment covers (used for upsert if missing)
 *   meta?: object        // any extra data (stored in Payment.raw)
 * }
 * - Verifies signature.
 * - Upserts/stores Payment if missing.
 * - Marks paid + flips users hasPaidSymposium=true.
 * - Idempotent.
 */
exports.updatePayment = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      currency = "INR",
      emails = [],
      meta = {}
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return fail(res, 400, "razorpay_order_id, razorpay_payment_id, razorpay_signature required");
    }

    // Verify signature
    const signBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", KEY_SECRET).update(signBody).digest("hex");
    if (expected !== razorpay_signature) return fail(res, 400, "Invalid payment signature");

    // Find or create Payment
    let p = await Payment.findOne({ orderId: razorpay_order_id, kind: "symposium" });

    if (!p) {
      // FE bypassed /order; we upsert a minimal doc now
      const leaderEmail = (req.user.email || "").toLowerCase();
      const provided = (emails || []).map(e => String(e || "").toLowerCase()).filter(Boolean);
      const memberEmails = Array.from(new Set([leaderEmail, ...provided]));

      if (!amount || typeof amount !== "number") {
        return fail(res, 400, "amount (paise) required when creating missing Payment");
      }

      p = await Payment.create({
        user: req.user._id,
        registration: null,
        kind: "symposium",
        memberEmails,
        amount,
        currency,
        orderId: razorpay_order_id,
        status: "created"
      });
    }

    // Idempotency
    if (p.status === "paid") {
      const covered = await User.find({ email: { $in: p.memberEmails } }).select("email hasPaidSymposium");
      return ok(res, 200, { message: "Already verified", covered });
    }

    // Mark paid + store raw
    p.status = "paid";
    p.paymentId = razorpay_payment_id;
    p.raw = { source: "update-endpoint", body: req.body, meta };
    await p.save();

    // Flip users
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
