// middleware/apiKey.js
const crypto = require("crypto");
const User = require("../models/User");

async function apiKeyGate(req, res, next) {
  const presented = req.header("x-api-key");
  if (!presented) {
    return res.status(401).json({
      success: false,
      code: "API_KEY_MISSING",
      message: "API key is required in 'x-api-key' header."
    });
  }

  // ✅ 1) Allow GLOBAL API KEY and attach synthetic super_admin principal
  if (presented === process.env.API_KEY) {
    req.apiKeyType = "global";
    req.user = { _id: "env-super-admin", role: "super_admin", name: "Env Super Admin" }; // <-- important
    return next();
  }

  // ✅ 2) Per-user API key (hashed lookup)
  try {
    const prefix = presented.slice(0, 8);
    const hash = crypto.createHash("sha256").update(presented, "utf8").digest("hex");

    const user = await User.findOne({
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
      apiKeyRevoked: false,
      isActive: true
    }).select("_id name email role department");

    if (!user) {
      return res.status(403).json({
        success: false,
        code: "API_KEY_INVALID",
        message: "Invalid API key."
      });
    }

    req.user = user;               // <-- so authorize(...) works
    req.apiKeyType = "user";
    await User.updateOne({ _id: user._id }, { apiKeyLastUsedAt: new Date() });

    return next();
  } catch (err) {
    console.error("API key check failed", err);
    return res.status(500).json({
      success: false,
      code: "API_KEY_ERROR",
      message: "Failed to validate API key"
    });
  }
}

module.exports = apiKeyGate; // <-- fix export
