// middleware/publicGuards.js
const rateLimit = require("express-rate-limit");

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 120,                 // 120 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false
});

// cheap cache headers for read-only analytics
function cacheMinutes(mins = 1) {
  return (req, res, next) => {
    res.set("Cache-Control", `public, max-age=${mins * 60}`);
    next();
  };
}

module.exports = { publicLimiter, cacheMinutes };
