// routes/v1/registrationRoutes.js
const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const requirePrincipal = require("../middleware/requirePrincipal");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/registrationController");

const router = express.Router();

// All endpoints require an API key first
router.use(apiKeyGate);

// End-user identity is required (per-user API key or Bearer JWT)
router.use(requirePrincipal);

// Create a registration (individual or team)
router.post("/", ctrl.create);

// My registrations
router.get("/my", ctrl.listMine);

// Get a registration by id (owner or admins)
router.get("/:id", ctrl.getById);

// Submit QR payment proof (owner)
router.post("/:id/payment/qr", ctrl.submitQrProof);

// Admin: verify payment (super_admin or department_admin of event department)
router.patch("/:id/verify-payment", authorize("super_admin", "department_admin"), ctrl.adminVerifyPayment);

module.exports = router;
