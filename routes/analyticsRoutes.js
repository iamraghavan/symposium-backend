// routes/v1/analyticsRoutes.js
const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const authorize = require("../middleware/authorize");
const stats = require("../controllers/analytics/statisticsController");
const ev = require("../controllers/analytics/eventAnalyticsController");
const dept = require("../controllers/analytics/departmentAnalyticsController");
const userAnalytics = require("../controllers/analytics/userAnalyticsController");

const router = express.Router();
router.use(apiKeyGate);

// Common/global stats
router.get("/statistics/overview", authorize("super_admin","department_admin"), stats.overview);
router.get("/statistics/participants", authorize("super_admin","department_admin"), stats.participantsCount);

// Per-event summaries
router.get("/statistics/events/registration-summary", authorize("super_admin","department_admin"), ev.registrationSummary);

// Department totals
router.get("/statistics/departments/:departmentId/totals", authorize("super_admin","department_admin"), dept.totals);

// Users analytics (first week)
router.get("/users/analytics/first-week", authorize("super_admin","department_admin"), userAnalytics.firstWeek);

module.exports = router;
