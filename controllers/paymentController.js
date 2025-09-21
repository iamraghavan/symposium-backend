// controllers/paymentController.js
const crypto = require("crypto");
const Payment = require("../models/Payment");
const Registration = require("../models/Registration");
const User = require("../models/User");

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function ok(res, body = {}) { return res.status(200).json({ success: true, ...body }); }
function bad(res, msg) { return res.status(400).json({ success: false, message: msg }); }

exports.webhook = async (req, res, next) => {
  try {
    // Signature verify (raw body!)
    const signature = req.header("x-razorpay-signature");
    const rawBody = JSON.stringify(req.body);
    const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    if (expected !== signature) return bad(res, "Invalid signature");

    const { event, payload = {} } = req.body;

    if (event === "payment.captured") {
      const pay = payload?.payment?.entity;
      const orderId = pay?.order_id;
      if (!orderId) return ok(res);

      const paymentDoc = await Payment.findOne({ orderId });
      if (!paymentDoc) return ok(res); // no matching order in our DB

      // idempotent
      if (paymentDoc.status === "paid") return ok(res);

      // mark payment doc
      paymentDoc.status = "paid";
      paymentDoc.paymentId = pay.id;
      paymentDoc.raw = req.body;
      await paymentDoc.save();

      // confirm registration
      const reg = await Registration.findById(paymentDoc.registration);
      if (reg) {
        reg.payment.status = "paid";
        reg.payment.gatewayPaymentId = pay.id;
        reg.payment.verifiedAt = new Date();
        reg.status = "confirmed";
        reg.payment.history.push({ kind: "webhook_paid", data: { orderId, paymentId: pay.id } });
        await reg.save();
      }

      // mark all covered users as paid-for-life
      if (paymentDoc.memberEmails?.length) {
        await User.updateMany(
          { email: { $in: paymentDoc.memberEmails } },
          { $set: { hasPaidEventFee: true, eventFeePaidAt: new Date() } }
        );
      }

      return ok(res);
    }

    // (Usually redundant)
    if (event === "order.paid") return ok(res);

    return ok(res);
  } catch (err) { next(err); }
};
