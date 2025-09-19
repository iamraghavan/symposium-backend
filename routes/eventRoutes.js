// routes/v1/eventRoutes.js
const express = require("express");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/eventController");

const router = express.Router();

/**
 * Public read (still requires x-api-key because your server gates /api/*)
 * - GET /api/v1/events
 * - GET /api/v1/events/:id
 * These do NOT require JWT — anyone with the API key can read published events.
 */
router.get("/", ctrl.listEvents);
router.get("/:id", ctrl.getEvent);

/**
 * Admin (JWT required)
 * - Only department_admin (own dept) and super_admin can create/manage
 */
router.post("/", auth, authorize("super_admin", "department_admin"), ctrl.createEvent);
router.patch("/:id", auth, authorize("super_admin", "department_admin"), ctrl.updateEvent);
router.delete("/:id", auth, authorize("super_admin", "department_admin"), ctrl.deleteEvent);

module.exports = router;
