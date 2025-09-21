// controllers/analytics/eventAnalyticsController.js
const { ok } = require("../../lib/http");
const { pickRange } = require("../../lib/dates");
const Registration = require("../../models/Registration");
const mongoose = require("mongoose");

exports.registrationSummary = async (req, res, next) => {
  try {
    const { from, to } = pickRange(req, { defDays: 30 });
    const { departmentId, page = 1, limit = 20, sort = "-participants" } = req.query;

    const sortStage = {};
    sort.split(",").forEach(s => {
      if (!s) return;
      const dir = s.startsWith("-") ? -1 : 1;
      const key = s.replace(/^[-+]/, "");
      sortStage[key] = dir;
    });

    const matchBase = { createdAt: { $gte: from, $lte: to }, status: { $in: ["pending","confirmed"] } };

    const pipeline = [
      { $match: matchBase },
      { $lookup: { from: "events", localField: "event", foreignField: "_id", as: "ev" } },
      { $set: { ev: { $first: "$ev" } } },
      ...(departmentId ? [{ $match: { "ev.department": mongoose.Types.ObjectId.createFromHexString(departmentId) } }] : []),
      { $group: {
          _id: { eventId: "$event", eventName: "$ev.name", departmentId: "$ev.department" },
          confirmed: { $sum: { $cond: [{ $eq: ["$status","confirmed"] }, 1, 0] } },
          pending:   { $sum: { $cond: [{ $eq: ["$status","pending"] }, 1, 0] } },
          participants: { $sum: {
            $cond: [
              { $eq: ["$type","team"] },
              { $size: { $ifNull: ["$team.members", []] } },
              1
            ]
          } }
      } },
      { $project: {
          eventId: "$_id.eventId",
          eventName: "$_id.eventName",
          departmentId: "$_id.departmentId",
          confirmed: 1, pending: 1, participants: 1
      } },
      { $sort: Object.keys(sortStage).length ? sortStage : { participants: -1 } }
    ];

    const agg = await Registration.aggregate(pipeline);
    const total = agg.length;
    const start = (page - 1) * limit;
    const rows = agg.slice(start, start + Number(limit));

    return ok(res, 200, {
      meta: { total, page: Number(page), limit: Number(limit), hasMore: start + Number(limit) < total },
      rows
    });
  } catch (err) { next(err); }
};
