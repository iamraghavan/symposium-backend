// models/Department.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const departmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4, // auto UUID
      unique: true
    },
    code: {
      type: String,
      required: true,
      unique: true // e.g., EGSPEC/MECH
    },
    name: {
      type: String,
      required: true
    },
    shortcode: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
