// controllers/departmentController.js
const mongoose = require("mongoose");
const Department = require("../models/Department");
const logger = require("../utils/logger");

const isObjectId = (id) => mongoose.isValidObjectId(id);
const bad = (res, status, message, details) =>
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });

/**
 * Create Department (super_admin)
 * Body: { code, name, shortcode, isActive? }
 */
exports.createDepartment = async (req, res, next) => {
  try {
    const { code, name, shortcode, isActive } = req.body || {};
    const errors = [];
    if (!code || !String(code).trim()) errors.push({ field: "code", msg: "code is required (e.g., EGSPEC/MECH)" });
    if (!name || !String(name).trim()) errors.push({ field: "name", msg: "name is required" });
    if (!shortcode || !String(shortcode).trim()) errors.push({ field: "shortcode", msg: "shortcode is required" });
    if (errors.length) return bad(res, 422, "Validation failed", errors);

    const exists = await Department.findOne({ $or: [{ code: code.trim() }, { shortcode: shortcode.trim() }] });
    if (exists) return bad(res, 409, "Department with same code or shortcode already exists");

    const dep = await Department.create({
      code: code.trim(),
      name: name.trim(),
      shortcode: shortcode.trim().toUpperCase(),
      isActive: typeof isActive === "boolean" ? isActive : true
    });

    return res.status(201).json({ success: true, data: dep });
  } catch (err) {
    logger.error("createDepartment error", { error: err.message });
    next(err);
  }
};

/**
 * List Departments (public read with API key)
 * Query: page, limit, sort, q, includeInactive (super_admin only)
 * Default: only active departments
 */
exports.listDepartments = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 100);
    const skip = (page - 1) * limit;
    const sort = (req.query.sort || "name").split(",").join(" ");

    const filter = {};
    // only super_admin (with JWT) can ask includeInactive=true, otherwise show only active
    const includeInactive = req.query.includeInactive === "true";
    if (!(req.user && req.user.role === "super_admin" && includeInactive)) {
      filter.isActive = true;
    }
    if (req.query.q) {
      const q = String(req.query.q);
      filter.$or = [
        { code: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { shortcode: { $regex: q, $options: "i" } }
      ];
    }

    const [items, total] = await Promise.all([
      Department.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Department.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      meta: { total, page, limit, hasMore: skip + items.length < total },
      data: items
    });
  } catch (err) {
    logger.error("listDepartments error", { error: err.message });
    next(err);
  }
};

/**
 * Get Department by id (public read with API key)
 * Path: /:id  (Mongo _id)
 * Only returns if active, unless super_admin (JWT) requests includeInactive=true
 */
exports.getDepartment = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid department id");

    const includeInactive = req.query.includeInactive === "true";
    const doc = await Department.findById(id).lean();
    if (!doc) return bad(res, 404, "Department not found");

    if (!doc.isActive && !(req.user && req.user.role === "super_admin" && includeInactive)) {
      return bad(res, 404, "Department not found");
    }

    return res.status(200).json({ success: true, data: doc });
  } catch (err) {
    logger.error("getDepartment error", { error: err.message });
    next(err);
  }
};

/**
 * Update Department (super_admin)
 * Body: { code?, name?, shortcode?, isActive? }
 */
exports.updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid department id");

    const dep = await Department.findById(id);
    if (!dep) return bad(res, 404, "Department not found");

    const { code, name, shortcode, isActive } = req.body || {};

    // Uniqueness checks if code/shortcode change
    if (typeof code === "string" && code.trim() && code.trim() !== dep.code) {
      const dup = await Department.findOne({ code: code.trim() });
      if (dup) return bad(res, 409, "code already exists");
      dep.code = code.trim();
    }
    if (typeof shortcode === "string" && shortcode.trim() && shortcode.trim().toUpperCase() !== dep.shortcode) {
      const dup = await Department.findOne({ shortcode: shortcode.trim().toUpperCase() });
      if (dup) return bad(res, 409, "shortcode already exists");
      dep.shortcode = shortcode.trim().toUpperCase();
    }
    if (typeof name === "string") dep.name = name.trim();
    if (typeof isActive === "boolean") dep.isActive = isActive;

    await dep.save();
    return res.status(200).json({ success: true, data: dep });
  } catch (err) {
    logger.error("updateDepartment error", { error: err.message });
    next(err);
  }
};

/**
 * Delete Department (super_admin) — soft delete
 * Sets isActive=false
 */
exports.deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid department id");

    const dep = await Department.findById(id);
    if (!dep) return bad(res, 404, "Department not found");

    dep.isActive = false;
    await dep.save();

    return res.status(200).json({ success: true, message: "Department deactivated" });
  } catch (err) {
    logger.error("deleteDepartment error", { error: err.message });
    next(err);
  }
};
