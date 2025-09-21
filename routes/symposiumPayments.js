// routes/symposiumPayments.js
const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const ctrl = require("../controllers/symposiumPaymentController");

const router = express.Router();
router.use(apiKeyGate);

// Check status for caller + optional emails list
router.get("/symposium/status", ctrl.status);

// Create order for symposium entry fee (leader + optional emails array)
router.post("/symposium/order", ctrl.createOrder);

// Verify payment signature and mark users paid
router.post("/symposium/verify", ctrl.verify);

module.exports = router;
