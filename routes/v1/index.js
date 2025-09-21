const express = require("express");
const router = express.Router();

/**
 * All v1 endpoints are mounted off this router.
 * Example groups: /auth, /events, /departments, etc.
 */

// Auth module (includes /register, /login, /google, /users CRUD, etc.)
router.use("/auth", require("../authRoutes"));
router.use("/events", require("../eventRoutes"));
router.use("/departments", require("../departmentRoutes"));
router.use("/registrations", require("../registrationRoutes")); 
router.use("/symposium-payments", require("../symposiumPayments"));

// analytics module
router.use("/analytics", require("../analyticsRoutes"));
// finance module
router.use("/finance", require("../financeRoutes"));

module.exports = router;
