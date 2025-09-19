// routes/v1/departmentRoutes.js
const express = require("express");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/departmentController");

const router = express.Router();

/**
 * READ (public with API key)
 * GET /api/v1/departments
 * GET /api/v1/departments/:id
 */
router.get("/", ctrl.listDepartments);
router.get("/:id", ctrl.getDepartment);

/**
 * WRITE (super_admin only)
 * POST /api/v1/departments
 * PATCH /api/v1/departments/:id
 * DELETE /api/v1/departments/:id
 */
router.post("/", auth, authorize("super_admin"), ctrl.createDepartment);
router.patch("/:id", auth, authorize("super_admin"), ctrl.updateDepartment);
router.delete("/:id", auth, authorize("super_admin"), ctrl.deleteDepartment);

module.exports = router;
