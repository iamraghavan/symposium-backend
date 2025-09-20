const mongoose = require("mongoose");
const Event = require("../models/Event");
const Department = require("../models/Department");
const logger = require("../utils/logger");
const User = require("../models/User");

/* -------------------------- helpers & guards -------------------------- */

const isObjectId = (id) => mongoose.isValidObjectId(id);

const bad = (res, status, message, details) =>
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });

const ensureDepartment = async (departmentId) => {
  if (!departmentId || !isObjectId(departmentId)) return "Invalid departmentId";
  const dep = await Department.findById(departmentId).lean();
  if (!dep || dep.isActive === false) return "Department not found or inactive";
  return null;
};

// Dept admin can act only within their department; super admin can act anywhere
const mustOwnDepartmentOrSuper = (user, departmentId) => {
  if (user?.role === "super_admin") return true;
  if (user?.role === "department_admin" && String(user.department || "") === String(departmentId || "")) return true;
  return false;
};

const toSlugFallback = (s = "") =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

/* -------------------------------- CREATE ------------------------------ */
exports.createEvent = async (req, res, next) => {
  try {
    const {
      name,
      description,
      thumbnailUrl,
      mode,              // 'online' | 'offline'
      online,            // { provider, url }
      offline,           // { venueName, address, mapLink }
      startAt,
      endAt,
      departmentId,
      payment,           // { method, gatewayProvider, gatewayLink, price, currency, qrImageUrl, qrInstructions, allowScreenshot }
      contacts,          // [{ name, phone, email }]
      departmentSite,
      contactEmail,
      extra,
      status             // 'draft' | 'published' | 'cancelled'
    } = req.body || {};

    const errors = [];
    if (!name || !String(name).trim()) errors.push({ field: "name", msg: "Event name is required" });
    if (!mode || !["online", "offline"].includes(mode)) errors.push({ field: "mode", msg: "mode must be 'online' or 'offline'" });

    const start = startAt ? new Date(startAt) : null;
    const end = endAt ? new Date(endAt) : null;
    if (!start || isNaN(start)) errors.push({ field: "startAt", msg: "Valid startAt is required (ISO date)" });
    if (!end || isNaN(end)) errors.push({ field: "endAt", msg: "Valid endAt is required (ISO date)" });
    if (start && end && start >= end) errors.push({ field: "endAt", msg: "endAt must be after startAt" });

    if (!departmentId || !isObjectId(departmentId)) errors.push({ field: "departmentId", msg: "departmentId is required" });
    if (errors.length) return bad(res, 422, "Validation failed", errors);

    const depErr = await ensureDepartment(departmentId);
    if (depErr) return bad(res, 422, depErr);

    if (!mustOwnDepartmentOrSuper(req.user, departmentId)) {
      return bad(res, 403, "Forbidden: cannot create event in another department");
    }

    if (mode === "online") {
      if (!online || !online.url) return bad(res, 422, "Online events require { online: { url } }");
    } else if (mode === "offline") {
      if (!offline || !offline.venueName) return bad(res, 422, "Offline events require { offline: { venueName } }");
    }

    const slug = typeof Event.toSlug === "function" ? Event.toSlug(name) : toSlugFallback(name);

    const doc = await Event.create({
      name: name.trim(),
      slug,
      description: description?.trim(),
      thumbnailUrl: thumbnailUrl?.trim(),
      mode,
      online: mode === "online"
        ? { provider: online?.provider || "other", url: online.url?.trim() }
        : undefined,
      offline: mode === "offline"
        ? {
            venueName: offline?.venueName?.trim(),
            address: offline?.address?.trim(),
            mapLink: offline?.mapLink?.trim()
          }
        : undefined,
      startAt: start,
      endAt: end,
      department: departmentId,
      createdBy: req.user._id,
      payment: payment
        ? {
            method: payment.method || "none",
            gatewayProvider: payment.gatewayProvider?.trim(),
            gatewayLink: payment.gatewayLink?.trim(),
            price: typeof payment.price === "number" ? payment.price : undefined,
            currency: payment.currency || "INR",
            qrImageUrl: payment.qrImageUrl?.trim(),
            qrInstructions: payment.qrInstructions?.trim(),
            allowScreenshot:
              typeof payment.allowScreenshot === "boolean" ? payment.allowScreenshot : true
          }
        : { method: "none" },
      contacts: Array.isArray(contacts) ? contacts.slice(0, 10) : [],
      departmentSite: departmentSite?.trim(),
      contactEmail: contactEmail?.trim()?.toLowerCase(),
      extra: extra && typeof extra === "object" ? extra : {},
      status: status && ["draft", "published", "cancelled"].includes(status) ? status : "draft",
      isActive: true
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    logger.error("createEvent error", { error: err.message });
    next(err);
  }
};

/* ------------------------------ PUBLIC GETS --------------------------- */

// PUBLIC: list published only
exports.listPublicEvents = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip  = (page - 1) * limit;
    const sort  = (req.query.sort || "-startAt").split(",").join(" ");

    const filter = { isActive: true, status: "published" };

    // Optional public filters
    if (req.query.departmentId && isObjectId(req.query.departmentId)) {
      filter.department = req.query.departmentId;
    }
    if (req.query.q) filter.name = { $regex: req.query.q, $options: "i" };
    if (req.query.upcoming === "true") filter.endAt = { $gte: new Date() };

    const [items, total] = await Promise.all([
      Event.find(filter)
        .sort(sort).skip(skip).limit(limit)
        .populate("department", "id code name shortcode")
        .populate("createdBy", "name email role")
        .lean(),
      Event.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      meta: { total, page, limit, hasMore: skip + items.length < total },
      data: items
    });
  } catch (err) { next(err); }
};

// PUBLIC: get one (only if published)
exports.getPublicEventById = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid event id");

    const doc = await Event.findById(id)
      .populate("department", "id code name shortcode")
      .populate("createdBy", "name email role")
      .lean();

    if (!doc || !doc.isActive) return bad(res, 404, "Event not found");
    if (doc.status !== "published") return bad(res, 403, "Forbidden");

    res.status(200).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

/* ------------------------------- ADMIN GETS --------------------------- */

// ADMIN: list all statuses
// dept_admin => all events in their department
// super_admin => all events (optionally filter departmentId)
exports.adminListEvents = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip  = (page - 1) * limit;
    const sort  = (req.query.sort || "-startAt").split(",").join(" ");

    const filter = { isActive: true };

    if (req.user.role === "department_admin") {
      filter.department = req.user.department; // ALL statuses in own dept
    } else if (req.user.role === "super_admin") {
      if (req.query.departmentId) {
        if (!isObjectId(req.query.departmentId)) return bad(res, 422, "Invalid departmentId");
        filter.department = req.query.departmentId;
      }
    }

    // Optional admin filters (status works here)
    if (req.query.status) {
      const allowed = ["draft", "published", "cancelled"];
      if (!allowed.includes(req.query.status)) return bad(res, 422, "Invalid status");
      filter.status = req.query.status;
    }
    if (req.query.q) filter.name = { $regex: req.query.q, $options: "i" };
    if (req.query.upcoming === "true") filter.endAt = { $gte: new Date() };

    const [items, total] = await Promise.all([
      Event.find(filter)
        .sort(sort).skip(skip).limit(limit)
        .populate("department", "id code name shortcode")
        .populate("createdBy", "name email role")
        .lean(),
      Event.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      meta: { total, page, limit, hasMore: skip + items.length < total },
      data: items
    });
  } catch (err) { next(err); }
};

// ADMIN: get one (all statuses)
// dept_admin => only inside their department
// super_admin => any
exports.adminGetEventById = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid event id");

    const doc = await Event.findById(id)
      .populate("department", "id code name shortcode")
      .populate("createdBy", "name email role")
      .lean();

    if (!doc || !doc.isActive) return bad(res, 404, "Event not found");

    if (req.user.role === "department_admin") {
      const sameDept = String(doc.department?._id || doc.department) === String(req.user.department || "");
      if (!sameDept) return bad(res, 403, "Forbidden");
    }
    // super_admin can read any

    res.status(200).json({ success: true, data: doc });
  } catch (err) { next(err); }
};

/* -------------------------------- UPDATE ------------------------------- */
// Dept admin: update any event in their department; super admin: update all
exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid event id");

    const doc = await Event.findById(id);
    if (!doc || !doc.isActive) return bad(res, 404, "Event not found");

    if (!mustOwnDepartmentOrSuper(req.user, doc.department)) {
      return bad(res, 403, "Forbidden");
    }

    const {
      name,
      description,
      thumbnailUrl,
      mode,
      online,
      offline,
      startAt,
      endAt,
      payment,
      contacts,
      departmentSite,
      contactEmail,
      extra,
      status
    } = req.body || {};

    if (typeof name === "string" && name.trim()) {
      doc.name = name.trim();
      if (!doc.slug || req.query.regenSlug === "true") {
        doc.slug = typeof Event.toSlug === "function" ? Event.toSlug(doc.name) : toSlugFallback(doc.name);
      }
    }
    if (typeof description === "string") doc.description = description.trim();
    if (typeof thumbnailUrl === "string") doc.thumbnailUrl = thumbnailUrl.trim();

    if (mode && ["online", "offline"].includes(mode)) {
      doc.mode = mode;
      if (mode === "online") doc.offline = undefined;
      else doc.online = undefined;
    }

    if (online && doc.mode === "online") {
      doc.online = {
        provider: online.provider || doc.online?.provider || "other",
        url: online.url?.trim() || doc.online?.url
      };
    }

    if (offline && doc.mode === "offline") {
      doc.offline = {
        venueName: offline.venueName?.trim() || doc.offline?.venueName,
        address: offline.address?.trim() || doc.offline?.address,
        mapLink: offline.mapLink?.trim() || doc.offline?.mapLink
      };
    }

    if (startAt) {
      const s = new Date(startAt);
      if (isNaN(s)) return bad(res, 422, "Invalid startAt");
      doc.startAt = s;
    }
    if (endAt) {
      const e = new Date(endAt);
      if (isNaN(e)) return bad(res, 422, "Invalid endAt");
      doc.endAt = e;
    }
    if (doc.startAt && doc.endAt && doc.startAt >= doc.endAt) {
      return bad(res, 422, "endAt must be after startAt");
    }

    if (payment && typeof payment === "object") {
      doc.payment = {
        method: payment.method || doc.payment?.method || "none",
        gatewayProvider: payment.gatewayProvider?.trim() || doc.payment?.gatewayProvider,
        gatewayLink: payment.gatewayLink?.trim() || doc.payment?.gatewayLink,
        price: typeof payment.price === "number" ? payment.price : doc.payment?.price,
        currency: payment.currency || doc.payment?.currency || "INR",
        qrImageUrl: payment.qrImageUrl?.trim() || doc.payment?.qrImageUrl,
        qrInstructions: payment.qrInstructions?.trim() || doc.payment?.qrInstructions,
        allowScreenshot:
          typeof payment.allowScreenshot === "boolean"
            ? payment.allowScreenshot
            : (doc.payment?.allowScreenshot ?? true)
      };
    }

    if (Array.isArray(contacts)) {
      doc.contacts = contacts.slice(0, 10);
    }
    if (typeof departmentSite === "string") doc.departmentSite = departmentSite.trim();
    if (typeof contactEmail === "string") doc.contactEmail = contactEmail.trim().toLowerCase();
    if (extra && typeof extra === "object") doc.extra = extra;

    if (status && ["draft", "published", "cancelled"].includes(status)) {
      doc.status = status;
    }

    await doc.save();
    return res.status(200).json({ success: true, data: doc });
  } catch (err) {
    logger.error("updateEvent error", { error: err.message });
    next(err);
  }
};

/* -------------------------------- DELETE ------------------------------- */
// Dept admin can delete any event in their department; super admin can delete all
exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid event id");

    const doc = await Event.findById(id);
    if (!doc || !doc.isActive) return bad(res, 404, "Event not found");

    if (!mustOwnDepartmentOrSuper(req.user, doc.department)) {
      return bad(res, 403, "Forbidden");
    }

    doc.isActive = false;
    await doc.save();

    return res.status(200).json({ success: true, message: "Event deleted" });
  } catch (err) {
    logger.error("deleteEvent error", { error: err.message });
    next(err);
  }
};

/* ----------------------- ADMIN: list by creator ----------------------- */
/**
 * GET /api/v1/events/admin/created-by/:userId
 * GET /api/v1/events/admin/created-by/me   (alias)
 *
 * Rules:
 * - super_admin: can view events created by any user (optionally filter to department via ?departmentId)
 * - department_admin: can view only events they created (or, if you want, within their department — here we enforce **self only**)
 *
 * Query: page, limit, sort, status?, q?, upcoming?=true, departmentId? (super_admin only)
 */
exports.adminListEventsByCreator = async (req, res, next) => {
  try {
    let { userId } = req.params || {};
    if (userId === "me") userId = String(req.user._id);

    if (!isObjectId(userId)) {
      return bad(res, 422, "Invalid creator user id");
    }

    // Fetch creator to verify role, helpful for messages and (optionally) restricting to department_admin
    const creator = await User.findById(userId).lean();
    if (!creator) return bad(res, 404, "Creator not found");

    // Scope: dept_admin can only view their own created events
    if (req.user.role === "department_admin" && String(req.user._id) !== String(userId)) {
      return bad(res, 403, "Forbidden: department admin can only view their own created events");
    }

    // Pagination & filters
    const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip  = (page - 1) * limit;
    const sort  = (req.query.sort || "-startAt").split(",").join(" ");

    const filter = { isActive: true, createdBy: userId };

    // super_admin may optionally filter department
    if (req.user.role === "super_admin" && req.query.departmentId) {
      if (!isObjectId(req.query.departmentId)) return bad(res, 422, "Invalid departmentId");
      filter.department = req.query.departmentId;
    }

    // Optional filters
    if (req.query.status) {
      const allowed = ["draft", "published", "cancelled"];
      if (!allowed.includes(req.query.status)) return bad(res, 422, "Invalid status");
      filter.status = req.query.status;
    }
    if (req.query.q) filter.name = { $regex: req.query.q, $options: "i" };
    if (req.query.upcoming === "true") filter.endAt = { $gte: new Date() };

    const [items, total] = await Promise.all([
      Event.find(filter)
        .sort(sort).skip(skip).limit(limit)
        .populate("department", "id code name shortcode")
        .populate("createdBy", "name email role")
        .lean(),
      Event.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      meta: { total, page, limit, hasMore: skip + items.length < total },
      creator: {
        _id: creator._id,
        name: creator.name,
        email: creator.email,
        role: creator.role,
        department: creator.department || null
      },
      data: items
    });
  } catch (err) {
    logger.error("adminListEventsByCreator error", { error: err.message });
    next(err);
  }
};