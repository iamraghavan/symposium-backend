// middleware/maybeAuth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function maybeAuth(req, _res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id)
        .select("_id role department")
        .lean();
      if (user) req.user = { _id: user._id, role: user.role, department: user.department };
    }
  } catch (_) {
    // ignore and continue as public
  }
  next();
};
