// controllers/analytics/departmentAnalyticsController.js
const { ok, fail } = require("../../lib/http");
const { pickRange } = require("../../lib/dates");
const Registration = require("../../models/Registration");
const Event = require("../../models/Event");
const mongoose = require("mongoose");

exports.totals = async (req, res, next) => {
  try {
    const { from, to } = pickRange(req, { defDays: 30 });
    const departmentId = req.params.departmentId;
    if (!mongoose.isValidObjectId(departmentId)) return fail(res, 422, "Invalid departmentId");

    const [events, regsAgg] = await Promise.all([
      Event.countDocuments({ department: departmentId, createdAt: { $gte: from, $lte: to } }),
      Registration.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: { $in: ["pending","confirmed"] } } },
        { $lookup: { from: "events", localField: "event", foreignField: "_id", as: "ev" } },
        { $set: { ev: { $first: "$ev" } } },
        { $match: { "ev.department": mongoose.Types.ObjectId.createFromHexString(departmentId) } },
        { $group: {
            _id: null,
            registrations: { $sum: 1 },
            participants: { $sum: {
              $cond: [
                { $eq: ["$type","team"] },
                { $size: { $ifNull: ["$team.members", []] } },
                1
              ]
            } }
        } }
      ])
    ]);

    return ok(res, 200, {
      departmentId,
      events,
      registrations: regsAgg[0]?.registrations || 0,
      participants: regsAgg[0]?.participants || 0
    });
  } catch (err) { next(err); }
};
