// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },

    password: { type: String },

    role: {
      type: String,
      enum: ["super_admin", "department_admin", "user"],
      default: "user",
      index: true
    },

    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

    // Google identity + profile
    googleId: { type: String, index: true },
    provider: { type: String, enum: ["local", "google"], default: "local" },

    // Rich profile
    picture: { type: String, default: null },
    givenName: { type: String, default: null },
    familyName: { type: String, default: null },
    locale: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },

    // Optional address
    address: { type: String, default: null },

    // --- API Key (per-user) ---
    // Plaintext API key (hidden by default). Only select it when you *really* need it.
    apiKey: { type: String, default: null, select: false },

    // Hashed + prefix for verification
    apiKeyHash: { type: String, default: null, select: false },
    apiKeyPrefix: { type: String, default: null, index: true }, // first 8 chars
    apiKeyCreatedAt: { type: Date, default: null },
    apiKeyLastUsedAt: { type: Date, default: null },
    apiKeyRevoked: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
