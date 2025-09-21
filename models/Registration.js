const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  email: { type: String, trim: true, lowercase: true, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  googleId: { type: String }
}, { _id: false });

const teamSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  members: { type: [teamMemberSchema], default: [] },
  size: { type: Number, min: 1 }
}, { _id: false });

const paymentEventSchema = new mongoose.Schema({
  kind: { type: String, enum: ["order_created", "checkout_ack", "webhook_paid"], required: true },
  at:   { type: Date, default: Date.now },
  data: { type: Object },
}, { _id: false });

const paymentDetailSchema = new mongoose.Schema({
  method:  { type: String, enum: ["none", "gateway"], default: "gateway", required: true },
  currency:{ type: String, default: "INR" },
  amount:  { type: Number, min: 0, default: 0 }, // INR for display

  status:  { type: String, enum: ["none", "pending", "paid", "failed"], default: "none", index: true },

  gatewayProvider:   { type: String, default: "razorpay" },
  gatewayOrderId:    { type: String, trim: true },
  gatewayPaymentId:  { type: String, trim: true },   // last success
  verifiedAt:        { type: Date, default: null },

  history: { type: [paymentEventSchema], default: [] } // append-only audit line
}, { _id: false });

const registrationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["individual", "team"], required: true },

  team: { type: teamSchema, default: undefined },

  status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending", index: true },

  payment: { type: paymentDetailSchema, required: true, default: () => ({ method: "gateway", status: "none" }) },

  notes: { type: String, trim: true },

  eventName: { type: String, trim: true },
  userEmail: { type: String, trim: true, lowercase: true }
}, { timestamps: true });

// Unique active registration per (user,event)
registrationSchema.index(
  { event: 1, user: 1, status: 1 },
  { partialFilterExpression: { status: { $in: ["pending", "confirmed"] } }, unique: true }
);

module.exports = mongoose.model("Registration", registrationSchema);
