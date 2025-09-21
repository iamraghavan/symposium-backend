// controllers/finance/financeController.js
const { ok } = require("../../lib/http");
const { pickRange } = require("../../lib/dates");
const Payment = require("../../models/Payment");
const Registration = require("../../models/Registration");
const Event = require("../../models/Event");
const mongoose = require("mongoose");

function toInr(paise) { return Math.round((Number(paise||0))/100 * 100) / 100; }

exports.overview = async (req, res, next) => {
  try {
    const { from, to } = pickRange(req, { defDays: 30 });
    const { kind } = req.query; // symposium|other|undefined

    const match = { status: "paid", createdAt: { $gte: from, $lte: to } };
    if (kind) match.kind = kind;

    const [grossAgg, countAgg, dailyAgg] = await Promise.all([
      Payment.aggregate([{ $match: match }, { $group: { _id: null, gross: { $sum: "$amount" } } }]),
      Payment.countDocuments(match),
      Payment.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { "_id": 1 } }
      ])
    ]);

    const grossPaise = grossAgg[0]?.gross || 0;
    const paidCount = countAgg;
    const avgTicketPaise = paidCount ? Math.round(grossPaise / paidCount) : 0;

    return ok(res, 200, {
      filters: { from, to, kind: kind || "all" },
      grossInr: toInr(grossPaise),
      paidCount,
      avgTicketInr: toInr(avgTicketPaise),
      byDay: dailyAgg.map(d => ({ date: d._id, amountInr: toInr(d.amount), count: d.count }))
    });
  } catch (err) { next(err); }
};

exports.transactions = async (req, res, next) => {
  try {
    const { page=1, limit=50, sort="-createdAt", status, kind, q, from, to } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (kind) where.kind = kind;
    if (from || to) where.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };

    if (q) {
      where.$or = [
        { orderId: { $regex: q, $options: "i" } },
        { paymentId: { $regex: q, $options: "i" } },
        { memberEmails: { $elemMatch: { $regex: q, $options: "i" } } }
      ];
    }

    const [total, rows] = await Promise.all([
      Payment.countDocuments(where),
      Payment.find(where).sort(sort.split(",").join(" ")).skip(skip).limit(Number(limit)).lean()
    ]);

    return ok(res, 200, {
      meta: { total, page: Number(page), limit: Number(limit), hasMore: skip + Number(limit) < total },
      rows
    });
  } catch (err) { next(err); }
};

// OPTIONAL: only if you can infer department on payments (e.g., via payment.registration -> event.department)
exports.revenueByDepartment = async (req, res, next) => {
  try {
    const { from, to } = pickRange(req, { defDays: 30 });

    const pipeline = [
      { $match: { status: "paid", createdAt: { $gte: from, $lte: to } } },
      { $lookup: { from: "registrations", localField: "registration", foreignField: "_id", as: "reg" } },
      { $set: { reg: { $first: "$reg" } } },
      { $lookup: { from: "events", localField: "reg.event", foreignField: "_id", as: "ev" } },
      { $set: { ev: { $first: "$ev" } } },
      { $group: { _id: "$ev.department", gross: { $sum: "$amount" }, transactions: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
      { $set: { dept: { $first: "$dept" } } },
      { $project: { departmentId: "$_id", departmentName: "$dept.name", grossInr: { $divide: ["$gross", 100] }, transactions: 1 } },
      { $sort: { grossInr: -1 } }
    ];

    const rows = await Payment.aggregate(pipeline);
    return ok(res, 200, { rows });
  } catch (err) { next(err); }
};
