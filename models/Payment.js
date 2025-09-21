const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // payer (leader for team)
  registration: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", index: true },
  // Optionally store all team member emails this order is intended to cover
  memberEmails: { type: [String], default: [] },

  amount: { type: Number, required: true },     // in paise
  currency: { type: String, default: "INR" },

  orderId: { type: String, required: true, index: true },
  paymentId: { type: String, default: null, index: true },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },

  raw: { type: Object }, // keep webhook payload for audit
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
