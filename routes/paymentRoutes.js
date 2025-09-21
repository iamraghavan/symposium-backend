const express = require("express");
const bodyParser = require("body-parser");
const ctrl = require("../controllers/paymentController");

const router = express.Router();

// Razorpay sends webhooks as raw body for signature verification.
// Use raw parser JUST for this route.
router.post(
  "/webhook",
  bodyParser.raw({ type: "*/*" }),
  (req, _res, next) => {
    try {
      // convert raw buffer to parsed JSON for controller
      req.body = JSON.parse(req.body.toString("utf8"));
      next();
    } catch (e) {
      next(e);
    }
  },
  ctrl.webhook
);

module.exports = router;
