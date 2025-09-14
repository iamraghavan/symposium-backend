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

    password: { type: String }, // not required for Google-only accounts

    role: {
      type: String,
      enum: ["super_admin", "department_admin", "user"],
      default: "user",
      index: true
    },

    // Reference to Department by ObjectId
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

    // Google identity + profile
    googleId: { type: String, index: true },
    provider: { type: String, enum: ["local", "google"], default: "local" },

    // Rich profile
    picture: { type: String, default: null },       // profile image url
    givenName: { type: String, default: null },
    familyName: { type: String, default: null },
    locale: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },

    // Optional address (not provided by basic Google userinfo; set by client if needed)
    address: { type: String, default: null },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
