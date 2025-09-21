const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const ctrl = require("../controllers/registrationController");
const { requireSymposiumPaidLeader, requireSymposiumPaidAll } = require("../middleware/symposiumPaid");

const router = express.Router();
router.use(apiKeyGate);

// For a single endpoint handling both individual & team,
// choose middleware based on body.type via a small wrapper:
router.post("/", (req, res, next) => {
  if ((req.body?.type || "individual") === "team") {
    return requireSymposiumPaidAll(req, res, next);
  }
  return requireSymposiumPaidLeader(req, res, next);
}, ctrl.create);

// Optional analytics
router.post("/:id/checkout-ack", ctrl.checkoutAck);

// My registrations
router.get("/my", ctrl.listMine);

// Get one
router.get("/:id", ctrl.getById);

module.exports = router;
