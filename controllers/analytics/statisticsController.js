// controllers/analytics/statisticsController.js
const { ok, fail } = require("../../lib/http");
const { pickRange } = require("../../lib/dates");
const User = require("../../models/User");
const Event = require("../../models/Event");
const Registration = require("../../models/Registration");

exports.overview = async (req, res, next) => {
  try {
    const { from, to } = pickRange(req, { defDays: 30 });
    const departmentId = req.query.departmentId || null;

    const matchEvent = { createdAt: { $gte: from, $lte: to } };
    const matchUser  = { createdAt: { $gte: from, $lte: to } };
    const matchReg   = { createdAt: { $gte: from, $lte: to }, status: { $in: ["pending","confirmed"] } };

    if (departmentId) {
      matchEvent.department = departmentId;
      // tie registrations to events by event field later if needed
    }

    const [
      usersCount,
      eventsCount,
      regsAgg,
      paidPasses,
      regsDaily
    ] = await Promise.all([
      User.countDocuments(matchUser),
      Event.countDocuments(matchEvent),
      Registration.aggregate([
        { $match: matchReg },
        ...(departmentId ? [{ $lookup: { from: "events", localField: "event", foreignField: "_id", as: "ev" } },
          { $set: { ev: { $first: "$ev" } } },
          { $match: { "ev.department": require("mongoose").Types.ObjectId.createFromHexString(departmentId) } }] : []),
        { $group: {
            _id: null,
            registrations: { $sum: 1 },
            confirmed: { $sum: { $cond: [{ $eq: ["$status","confirmed"] }, 1, 0] } },
            participants: {
              $sum: {
                $cond: [
                  { $eq: ["$type","team"] },
                  { $size: { $ifNull: ["$team.members", []] } },
                  1
                ]
              }
            }
        } }
      ]),
      User.countDocuments({ hasPaidSymposium: true, symposiumPaidAt: { $gte: from, $lte: to } }),
      Registration.aggregate([
        { $match: matchReg },
        ...(departmentId ? [{ $lookup: { from: "events", localField: "event", foreignField: "_id", as: "ev" } },
          { $set: { ev: { $first: "$ev" } } },
          { $match: { "ev.department": require("mongoose").Types.ObjectId.createFromHexString(departmentId) } }] : []),
        { $group: {
          _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } },
          count: { $sum: 1 }
        } },
        { $sort: { "_id": 1 } }
      ])
    ]);

    const regs = regsAgg[0] || { registrations: 0, confirmed: 0, participants: 0 };

    return ok(res, 200, {
      scope: { departmentId, from, to },
      kpis: {
        users: usersCount,
        events: eventsCount,
        registrations: regs.registrations,
        participants: regs.participants,
        paidPasses
      },
      sparklines: { registrationsDaily: regsDaily.map(d => ({ date: d._id, count: d.count })) }
    });
  } catch (err) { next(err); }
};

exports.participantsCount = async (req, res, next) => {
  try {
    const { from, to } = pickRange(req, { defDays: 30 });
    const departmentId = req.query.departmentId || null;

    const pipeline = [
      { $match: { createdAt: { $gte: from, $lte: to }, status: "confirmed" } },
      ...(departmentId ? [
        { $lookup: { from: "events", localField: "event", foreignField: "_id", as: "ev" } },
        { $set: { ev: { $first: "$ev" } } },
        { $match: { "ev.department": require("mongoose").Types.ObjectId.createFromHexString(departmentId) } }
      ] : []),
      { $project: {
        emails: {
          $cond: [
            { $eq: ["$type","team"] },
            { $map: { input: { $ifNull: ["$team.members", []] }, as: "m", in: { $toLower: "$$m.email" } } },
            [{ $toLower: "$userEmail" }]
          ]
        },
        createdAt: 1
      } },
      { $unwind: "$emails" },
      { $group: { _id: "$emails" } },
      { $count: "unique" }
    ];

    const daily = [
      { $match: { createdAt: { $gte: from, $lte: to }, status: "confirmed" } },
      ...(departmentId ? [
        { $lookup: { from: "events", localField: "event", foreignField: "_id", as: "ev" } },
        { $set: { ev: { $first: "$ev" } } },
        { $match: { "ev.department": require("mongoose").Types.ObjectId.createFromHexString(departmentId) } }
      ] : []),
      { $project: {
        date: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } },
        emails: {
          $cond: [
            { $eq: ["$type","team"] },
            { $map: { input: { $ifNull: ["$team.members", []] }, as: "m", in: { $toLower: "$$m.email" } } },
            [{ $toLower: "$userEmail" }]
          ]
        }
      } },
      { $unwind: "$emails" },
      { $group: { _id: { date: "$date", email: "$emails" } } },
      { $group: { _id: "$_id.date", unique: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ];

    const [agg, perDay] = await Promise.all([
      require("../../models/Registration").aggregate(pipeline),
      require("../../models/Registration").aggregate(daily)
    ]);
    const uniqueParticipants = agg[0]?.unique || 0;

    return ok(res, 200, {
      uniqueParticipants,
      byDay: perDay.map(d => ({ date: d._id, unique: d.unique }))
    });
  } catch (err) { next(err); }
};
