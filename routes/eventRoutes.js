const express = require("express");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/eventController");

const router = express.Router();

// Public read (API key still required at /api/*)
router.get("/", ctrl.listEvents);
router.get("/:id", ctrl.getEvent);

// Admin (JWT required)
router.post("/", auth, authorize("super_admin", "department_admin"), ctrl.createEvent);
router.patch("/:id", auth, authorize("super_admin", "department_admin"), ctrl.updateEvent);
router.delete("/:id", auth, authorize("super_admin", "department_admin"), ctrl.deleteEvent);

module.exports = router;
