// models/Payment.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // payer (API-key owner / leader)
  registration: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", index: true, default: null },

  // NEW: distinguish entry-fee vs other payments
  kind: { type: String, enum: ["symposium", "other"], default: "symposium", index: true },

  memberEmails: { type: [String], default: [] }, // emails the order covers

  amount: { type: Number, required: true }, // in paise
  currency: { type: String, default: "INR" },

  orderId: { type: String, required: true, index: true },
  paymentId: { type: String, default: null, index: true },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },

  raw: { type: Object } // (optional) external payload
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
