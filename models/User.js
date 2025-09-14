// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String }, // not required for Google-only accounts
    role: {
      type: String,
      enum: ["super_admin", "department_admin", "user"],
      default: "user",
      index: true
    },
    // 🔴 UPDATED: reference Department by ObjectId
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    googleId: { type: String, index: true },
    provider: { type: String, enum: ["local", "google"], default: "local" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
