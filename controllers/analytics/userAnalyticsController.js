// controllers/analytics/userAnalyticsController.js
const { ok } = require("../../lib/http");
const { pickRange } = require("../../lib/dates");
const User = require("../../models/User");

exports.firstWeek = async (req, res, next) => {
  try {
    const { from, to } = pickRange(req, { defDays: 7 });
    const departmentId = req.query.departmentId || null;

    const match = { createdAt: { $gte: from, $lte: to } };
    if (departmentId) match.department = departmentId;

    const series = await User.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } }, count: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]);

    const total = series.reduce((a,b) => a + b.count, 0);
    return ok(res, 200, { series: series.map(d => ({ date: d._id, count: d.count })), total });
  } catch (err) { next(err); }
};
