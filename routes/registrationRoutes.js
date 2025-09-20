// routes/registrations.js
const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/registrationController");

const router = express.Router();

// All endpoints require an API key first (global or per-user).
// When a **per-user** key is used, apiKeyGate will attach req.user with `provider`.
router.use(apiKeyGate);

// Create a registration (individual or team) — must be a Google user (checked in controller)
router.post("/", ctrl.create);

// My registrations (per-user API key)
router.get("/my", ctrl.listMine);

// Get a registration by id (owner or admins)
router.get("/:id", ctrl.getById);

// Submit QR payment proof (owner)
router.post("/:id/payment/qr", ctrl.submitQrProof);

// Admin: verify payment (super_admin or department_admin with proper scope)
router.patch(
  "/:id/verify-payment",
  authorize("super_admin", "department_admin"),
  ctrl.adminVerifyPayment
);

module.exports = router; // ✅ fix export casing/spacing
