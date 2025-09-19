// models/Event.js
const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true }
  },
  { _id: false }
);

const onlineSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["google_meet", "zoom", "other"],
      default: "other"
    },
    url: { type: String, trim: true }
  },
  { _id: false }
);

const offlineSchema = new mongoose.Schema(
  {
    venueName: { type: String, trim: true },
    address: { type: String, trim: true },
    mapLink: { type: String, trim: true }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["none", "gateway", "qr"], default: "none" },
    // gateway
    gatewayProvider: { type: String, trim: true }, // e.g., razorpay/stripe
    gatewayLink: { type: String, trim: true },
    price: { type: Number, min: 0 },
    currency: { type: String, default: "INR" },
    // qr
    qrImageUrl: { type: String, trim: true },
    qrInstructions: { type: String, trim: true },
    allowScreenshot: { type: Boolean, default: true }
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true }, // SEO/id
    description: { type: String, trim: true },
    thumbnailUrl: { type: String, trim: true },

    mode: { type: String, enum: ["online", "offline"], required: true },
    online: { type: onlineSchema, default: undefined },
    offline: { type: offlineSchema, default: undefined },

    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },

    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    payment: { type: paymentSchema, default: () => ({ method: "none" }) },

    contacts: { type: [contactSchema], default: [] },

    departmentSite: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },

    extra: { type: Object, default: {} }, // flexible metadata

    status: {
      type: String,
      enum: ["draft", "published", "cancelled"],
      default: "draft",
      index: true
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// simple slug generator (unique-ish). You can replace with a stronger lib if needed.
eventSchema.statics.toSlug = function (name) {
  return (
    String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
};

module.exports = mongoose.model("Event", eventSchema);
