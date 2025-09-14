// middleware/acceptJson.js (light check)
module.exports = function acceptJson(req, res, next) {
  const accept = (req.headers["accept"] || "").toLowerCase();
  const ok =
    accept === "" ||
    accept === "*/*" ||
    accept.includes("application/json");

  if (!ok) {
    return res.status(406).json({
      success: false,
      code: "NOT_ACCEPTABLE",
      message: "Only 'application/json' responses are supported."
    });
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
};
