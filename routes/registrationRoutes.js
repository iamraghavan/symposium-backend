const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/registrationController");

const router = express.Router();

// All endpoints require an API key first
router.use(apiKeyGate); // <-- must attach req.user when the key is a USER API key

// Create a registration (individual or team)
router.post("/", ctrl.create);

// My registrations
router.get("/my", ctrl.listMine);

// Get a registration by id (owner or admins)
router.get("/:id", ctrl.getById);

// Submit QR payment proof (owner)
router.post("/:id/payment/qr", ctrl.submitQrProof);

// Admin: verify payment
router.patch("/:id/verify-payment", authorize("super_admin", "department_admin"), ctrl.adminVerifyPayment);

module.exports = router;
