const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const ctrl = require("../controllers/paymentController");

const router = express.Router();

// Protect with API key (per-user key recommended)
router.use(apiKeyGate);

// Create order for a registration (only for still-unpaid people)
router.post("/order", ctrl.createOrder);

// Verify payment signature and finalize registration
router.post("/verify", ctrl.verify);

module.exports = router;
