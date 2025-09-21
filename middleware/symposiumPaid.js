// middleware/symposiumPaid.js
const User = require("../models/User");

function fail(res, status, message, meta={}) {
  return res.status(status).json({ success: false, message, ...meta });
}

// 402 Payment Required (semantically correct for “you must pay first”)
const PAYMENT_REQUIRED = 402;

exports.requireSymposiumPaidLeader = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");
    const u = await User.findById(req.user._id).select("hasPaidSymposium email");
    if (!u) return fail(res, 404, "User not found");
    if (!u.hasPaidSymposium) {
      return fail(res, PAYMENT_REQUIRED, "Symposium entry fee unpaid", {
        payment: { neededFor: [u.email], feeInInr: Number(process.env.PAYMENT_FEE_INR || 250) }
      });
    }
    next();
  } catch (err) { next(err); }
};

exports.requireSymposiumPaidAll = async (req, res, next) => {
  try {
    if (!req.user) return fail(res, 401, "Unauthorized");

    const leaderEmail = (req.user.email || "").toLowerCase();
    const bodyTeam = req.body?.team;
    const teamEmails = (bodyTeam?.members || []).map(m => String(m.email || "").toLowerCase());
    const emails = Array.from(new Set([leaderEmail, ...teamEmails].filter(Boolean)));

    const users = await User.find({ email: { $in: emails } }).select("email hasPaidSymposium");
    const paidMap = new Map(users.map(u => [u.email.toLowerCase(), u.hasPaidSymposium]));
    const unpaid = emails.filter(e => !paidMap.get(e));

    if (unpaid.length > 0) {
      return fail(res, PAYMENT_REQUIRED, "Some members have not paid the symposium entry fee", {
        unpaidEmails: unpaid,
        feeInInr: Number(process.env.PAYMENT_FEE_INR || 250)
      });
    }
    next();
  } catch (err) { next(err); }
};
