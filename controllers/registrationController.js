// controllers/registrationController.js
const mongoose = require("mongoose");
const Registration = require("../models/Registration");
const Event = require("../models/Event");
const logger = require("../utils/logger");

const isObjectId = (id) => mongoose.isValidObjectId(id);
const bad = (res, status, message, details) =>
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });

/**
 * POST /api/v1/registrations
 * Body:
 *  - eventId (required)
 *  - type: "individual" | "team" (required)
 *  - team?: { name?, members:[{name,email}] }  // leader is the authenticated user; do not include leader here
 *  - notes?: string
 *
 * Only Google-signed users may register (provider === 'google').
 * Free event => auto-confirmed.
 * Paid event => payment.status = "pending".
 */
exports.create = async (req, res, next) => {
  try {
    const { eventId, type, team, notes } = req.body || {};
    const actor = req.user;

    if (!actor) return bad(res, 401, "Unauthorized");
    if (actor.provider !== "google") {
      return bad(res, 403, "Registration requires Google login.");
    }

    if (!isObjectId(eventId)) return bad(res, 422, "Invalid eventId");
    if (!["individual", "team"].includes(type)) return bad(res, 422, "type must be 'individual' or 'team'");

    const ev = await Event.findById(eventId).lean();
    if (!ev || !ev.isActive) return bad(res, 404, "Event not found");
    if (ev.status !== "published") return bad(res, 403, "Event is not open for registration");

    // Prevent duplicate active registrations by same user
    const dup = await Registration.findOne({
      event: eventId,
      user: actor._id,
      status: { $in: ["pending", "confirmed"] }
    }).lean();
    if (dup) return bad(res, 409, "You already have a registration for this event");

    // Build payment seed from event
    const payment = {
      method: ev.payment?.method || "none",
      currency: ev.payment?.currency || "INR",
      amount: typeof ev.payment?.price === "number" ? ev.payment.price : 0,
      status: ev.payment?.method === "none" ? "none" : "pending",
      gatewayProvider: ev.payment?.gatewayProvider,
      gatewayLink: ev.payment?.gatewayLink
      // gatewayOrderId/paymentId/signature remain empty for now
    };

    // Team validation
    let teamDoc;
    if (type === "team") {
      if (!team || !Array.isArray(team.members) || team.members.length < 1) {
        return bad(res, 422, "Team registrations require at least 1 member (besides the leader)");
      }
      const cleanMembers = team.members.map((m) => ({
        name: String(m.name || "").trim(),
        email: String(m.email || "").toLowerCase().trim()
      })).filter(m => m.name && m.email);

      if (cleanMembers.length !== team.members.length) {
        return bad(res, 422, "Each team member must have name and email");
      }

      // De-dupe member emails and ensure leader's email is not listed as member
      const emails = new Set(cleanMembers.map(m => m.email));
      if (emails.has(String(actor.email).toLowerCase())) {
        return bad(res, 422, "Leader cannot also be listed as a team member");
      }
      if (emails.size !== cleanMembers.length) {
        return bad(res, 422, "Duplicate member emails found");
      }

      teamDoc = {
        name: team.name ? String(team.name).trim() : undefined,
        members: cleanMembers,
        size: cleanMembers.length + 1 // include leader
      };
    }

    const doc = await Registration.create({
      event: ev._id,
      user: actor._id,
      type,
      team: teamDoc,
      status: payment.method === "none" ? "confirmed" : "pending",
      payment,
      notes: typeof notes === "string" ? notes.trim() : undefined,
      eventName: ev.name,
      userEmail: actor.email
    });

    // Response hints for client based on payment type
    const hints =
      payment.method === "none"
        ? { next: "confirmed" }
        : payment.method === "gateway"
        ? { next: "pay_gateway", gatewayLink: payment.gatewayLink, provider: payment.gatewayProvider }
        : { next: "submit_qr_proof" };

    return res.status(201).json({ success: true, data: doc, hints });
  } catch (err) {
    logger.error("registration.create error", { error: err.message });
    next(err);
  }
};

/**
 * GET /api/v1/registrations/my
 * List registrations for current user
 */
exports.listMine = async (req, res, next) => {
  try {
    if (!req.user) return bad(res, 401, "Unauthorized");

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Registration.find({ user: req.user._id })
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .populate("event", "name startAt endAt department status")
        .lean(),
      Registration.countDocuments({ user: req.user._id })
    ]);

    return res.status(200).json({
      success: true,
      meta: { total, page, limit, hasMore: skip + items.length < total },
      data: items
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/registrations/:id
 * Owner can view; super_admin or department_admin of the event's department can view.
 */
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid registration id");

    const reg = await Registration.findById(id)
      .populate("event", "department name status isActive")
      .populate("user", "name email role department")
      .lean();

    if (!reg) return bad(res, 404, "Not found");

    // owner
    if (String(reg.user?._id || reg.user) === String(req.user?._id)) {
      return res.status(200).json({ success: true, data: reg });
    }

    // admins
    const role = req.user?.role;
    if (role === "super_admin") {
      return res.status(200).json({ success: true, data: reg });
    }
    if (role === "department_admin") {
      // load event’s department for scope check if not populated fully
      const deptId = String(reg.event?.department || "");
      if (deptId && String(req.user.department || "") === deptId) {
        return res.status(200).json({ success: true, data: reg });
      }
    }

    return bad(res, 403, "Forbidden");
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/registrations/:id/payment/qr
 * Body: { qrReference, qrScreenshotUrl? }
 * User can attach QR UTR/reference & screenshot for admins to verify.
 */
exports.submitQrProof = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    const { qrReference, qrScreenshotUrl } = req.body || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid registration id");
    if (!req.user) return bad(res, 401, "Unauthorized");

    const reg = await Registration.findById(id);
    if (!reg) return bad(res, 404, "Registration not found");
    if (String(reg.user) !== String(req.user._id)) return bad(res, 403, "Forbidden");

    if (reg.payment.method !== "qr") return bad(res, 422, "This registration does not use QR payments");
    if (!qrReference || !String(qrReference).trim()) return bad(res, 422, "qrReference is required");

    reg.payment.qrReference = String(qrReference).trim();
    if (typeof qrScreenshotUrl === "string") reg.payment.qrScreenshotUrl = qrScreenshotUrl.trim();
    // remains pending until admin verifies
    await reg.save();

    return res.status(200).json({ success: true, message: "QR details submitted; awaiting verification." });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/registrations/:id/verify-payment
 * Admin only (super_admin or department_admin owning the event department)
 * Body: { status: "paid" | "failed" }
 * When set to "paid": payment.verifiedAt/by set, registration.status => confirmed
 */
exports.adminVerifyPayment = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Invalid registration id");

    const reg = await Registration.findById(id).populate("event", "department");
    if (!reg) return bad(res, 404, "Registration not found");

    // scope
    const role = req.user?.role;
    if (role !== "super_admin" && role !== "department_admin") return bad(res, 403, "Forbidden");
    if (role === "department_admin" &&
        String(req.user.department || "") !== String(reg.event?.department || "")) {
      return bad(res, 403, "Forbidden");
    }

    if (reg.payment.method === "none") return bad(res, 422, "Free registration does not require verification");
    const { status } = req.body || {};
    if (!["paid", "failed"].includes(status)) return bad(res, 422, "status must be 'paid' or 'failed'");

    reg.payment.status = status;
    if (status === "paid") {
      reg.payment.verifiedAt = new Date();
      reg.payment.verifiedBy = req.user._id;
      reg.status = "confirmed";
    } else {
      reg.status = "pending"; // keep pending; or set 'cancelled' if you prefer
    }
    await reg.save();

    return res.status(200).json({ success: true, data: reg });
  } catch (err) {
    next(err);
  }
};
