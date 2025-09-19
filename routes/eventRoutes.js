const express = require("express");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/eventController");

const router = express.Router();

/* ---- Admin listing (all statuses) ----
 * IMPORTANT: put these BEFORE '/:id' so '/admin' doesn't get captured by ':id'
 */
router.get(
  "/admin",
  auth,
  authorize("super_admin", "department_admin"),
  ctrl.adminListEvents
); // GET /api/v1/events/admin

router.get(
  "/admin/:id",
  auth,
  authorize("super_admin", "department_admin"),
  ctrl.adminGetEventById
); // GET /api/v1/events/admin/:id

/* ---- Public listing (published-only) ---- */
router.get("/", ctrl.listPublicEvents);      // GET /api/v1/events
router.get("/:id", ctrl.getPublicEventById); // GET /api/v1/events/:id

/* ---- Admin manage ---- */
router.post("/", auth, authorize("super_admin", "department_admin"), ctrl.createEvent);
router.patch("/:id", auth, authorize("super_admin", "department_admin"), ctrl.updateEvent);
router.delete("/:id", auth, authorize("super_admin", "department_admin"), ctrl.deleteEvent);

module.exports = router;
