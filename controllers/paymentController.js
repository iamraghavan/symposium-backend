const crypto = require("crypto");
const Payment = require("../models/Payment");
const Registration = require("../models/Registration");
const User = require("../models/User");

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Webhook-only verification. No manual admin verification anywhere.
exports.webhook = async (req, res, next) => {
  try {
    const signature = req.header("x-razorpay-signature");
    const rawBody = JSON.stringify(req.body);

    const expected = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expected !== signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const event = req.body?.event;
    const payload = req.body?.payload || {};

    // Primary path: payment captured
    if (event === "payment.captured") {
      const pay = payload?.payment?.entity;
      const orderId = pay?.order_id;
      if (!orderId) return res.json({ success: true });

      const paymentDoc = await Payment.findOne({ orderId });
      if (!paymentDoc) return res.json({ success: true });

      // Idempotency: if already marked paid, just ACK
      if (paymentDoc.status === "paid") return res.json({ success: true });

      paymentDoc.status = "paid";
      paymentDoc.paymentId = pay.id;
      paymentDoc.raw = req.body;
      await paymentDoc.save();

      // Confirm registration linked to this payment
      const reg = await Registration.findById(paymentDoc.registration);
      if (reg) {
        reg.payment.status = "paid";
        reg.payment.gatewayPaymentId = pay.id;
        reg.payment.verifiedAt = new Date(); // evidence time (webhook verified)
        reg.status = "confirmed";
        await reg.save();
      }

      // Crucial: mark all covered people as "hasPaidEventFee" (one-time fee for life)
      if (paymentDoc.memberEmails?.length) {
        await User.updateMany(
          { email: { $in: paymentDoc.memberEmails } },
          { $set: { hasPaidEventFee: true, eventFeePaidAt: new Date() } }
        );
      }

      return res.json({ success: true });
    }

    // Optional: order.paid (usually redundant)
    if (event === "order.paid") {
      return res.json({ success: true });
    }

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
