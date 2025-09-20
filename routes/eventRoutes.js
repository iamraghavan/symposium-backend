const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/eventController");

const router = express.Router();

// All routes require API key first
router.use(apiKeyGate);

/* ---- Admin listing (all statuses) ---- */
router.get("/admin", authorize("super_admin", "department_admin"), ctrl.adminListEvents);
router.get("/admin/:id", authorize("super_admin", "department_admin"), ctrl.adminGetEventById);

/* ---- Public listing (published-only) ---- */
router.get("/", ctrl.listPublicEvents);
router.get("/:id", ctrl.getPublicEventById);

/* ---- Admin manage ---- */
router.post("/", authorize("super_admin", "department_admin"), ctrl.createEvent);
router.patch("/:id", authorize("super_admin", "department_admin"), ctrl.updateEvent);
router.delete("/:id", authorize("super_admin", "department_admin"), ctrl.deleteEvent);

module.exports = router;
