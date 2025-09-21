// routes/v1/analyticsRoutes.js
const express = require("express");
const stats = require("../controllers/analytics/statisticsController");
const ev = require("../controllers/analytics/eventAnalyticsController");
const dept = require("../controllers/analytics/departmentAnalyticsController");
const userAnalytics = require("../controllers/analytics/userAnalyticsController");
const { publicLimiter, cacheMinutes } = require("../middleware/publicGuards");

const router = express.Router();

// Public, read-only; add small rate limit + 60s cache
router.use(publicLimiter);

// Common/global stats
router.get("/statistics/overview", cacheMinutes(1), stats.overview);
router.get("/statistics/participants", cacheMinutes(1), stats.participantsCount);

// Per-event summaries
router.get("/statistics/events/registration-summary", cacheMinutes(1), ev.registrationSummary);

// Department totals
router.get("/statistics/departments/:departmentId/totals", cacheMinutes(1), dept.totals);

// Users analytics (first week)
router.get("/users/analytics/first-week", cacheMinutes(1), userAnalytics.firstWeek);

module.exports = router;
