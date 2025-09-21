const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const ctrl = require("../controllers/registrationController");

const router = express.Router();

router.use(apiKeyGate);

// Idempotent create
router.post("/", ctrl.create);

// Optional client ack (analytics only; does not affect state)
router.post("/:id/checkout-ack", ctrl.checkoutAck);

// My registrations
router.get("/my", ctrl.listMine);

// Get one
router.get("/:id", ctrl.getById);

module.exports = router;
