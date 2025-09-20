// models/Registration.js
const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional if the member also has an account
    googleId: { type: String } // optional convenience
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true }, // optional: team name
    members: { type: [teamMemberSchema], default: [] },
    size: { type: Number, min: 1 }
  },
  { _id: false }
);

const paymentDetailSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["none", "gateway", "qr"], required: true },
    currency: { type: String, default: "INR" },
    amount: { type: Number, min: 0 },

    status: { type: String, enum: ["none", "pending", "paid", "failed"], default: "none", index: true },

    // gateway
    gatewayProvider: { type: String, trim: true },
    gatewayLink: { type: String, trim: true }, // copied from Event.payment.gatewayLink if provided
    gatewayOrderId: { type: String, trim: true },
    gatewayPaymentId: { type: String, trim: true },
    gatewaySignature: { type: String, trim: true },

    // qr
    qrReference: { type: String, trim: true },     // user-entered UTR/Ref no.
    qrScreenshotUrl: { type: String, trim: true }, // optional evidence

    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // individual or team leader

    type: { type: String, enum: ["individual", "team"], required: true },

    team: { type: teamSchema, default: undefined },

    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending", index: true },

    payment: { type: paymentDetailSchema, required: true },

    notes: { type: String, trim: true }, // optional freeform

    // quick denormalized snapshot helpful for listings
    eventName: { type: String, trim: true },
    userEmail: { type: String, trim: true, lowercase: true }
  },
  { timestamps: true }
);

// Unique index: one active registration per (user,event) for individual OR team leader
registrationSchema.index(
  { event: 1, user: 1, status: 1 },
  { partialFilterExpression: { status: { $in: ["pending", "confirmed"] } }, unique: true }
);

module.exports = mongoose.model("Registration", registrationSchema);
