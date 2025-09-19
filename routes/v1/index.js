const express = require("express");
const router = express.Router();

/**
 * All v1 endpoints are mounted off this router.
 * Example groups: /auth, /events, /departments, etc.
 */

// Auth module (includes /register, /login, /google, /users CRUD, etc.)
router.use("/auth", require("../authRoutes"));
router.use("/events", require("../eventRoutes"));


module.exports = router;
