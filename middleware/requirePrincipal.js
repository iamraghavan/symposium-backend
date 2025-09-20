// middleware/requirePrincipal.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function requirePrincipal(req, res, next) {
  try {
    // If apiKeyGate already attached a user (per-user API key), normalize to principal too
    if (req.user && req.user._id) {
      req.principal = req.user;
      return next();
    }

    // Else try Authorization: Bearer <jwt>
    const hdr = req.headers.authorization || req.headers.Authorization;
    const token = hdr && hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required (per-user x-api-key or Bearer JWT)."
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.id).select(
      "_id name email role department provider googleId emailVerified isActive"
    );

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Invalid or inactive user." });
    }

    // normalize
    req.user = user;        // keep compatibility with existing code
    req.principal = user;   // explicit alias
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};
