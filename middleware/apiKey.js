// middleware/apiKey.js
module.exports = function apiKeyGate(req, res, next) {
  const presented = req.header("x-api-key");
  if (!presented) {
    return res.status(401).json({
      success: false,
      code: "API_KEY_MISSING",
      message: "API key is required in 'x-api-key' header."
    });
  }
  if (presented !== process.env.API_KEY) {
    return res.status(403).json({
      success: false,
      code: "API_KEY_INVALID",
      message: "Invalid API key."
    });
  }
  return next();
};
