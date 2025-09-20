// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken"); // kept for email/password flow
const { OAuth2Client } = require("google-auth-library");
const mongoose = require("mongoose");
const crypto = require("crypto");
const axios = require("axios");

const User = require("../models/User");
const Department = require("../models/Department");
const logger = require("../utils/logger");

/* ============================= Google OAuth ============================= */

const googleClientId = process.env.Google_Client_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.Google_Client_Secret || process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;

const oauth2Client = new OAuth2Client({
  clientId: googleClientId,
  clientSecret: googleClientSecret,
  redirectUri: googleRedirectUri
});

/* ============================= Helpers ============================= */

// Generate a human-pasteable API key: "uk_" + 40-hex chars (total 43)
const generateRawApiKey = () => "uk_" + crypto.randomBytes(20).toString("hex");

// Hash with sha256 (fast lookup); swap to bcrypt if you prefer KDF hardness
const hashApiKey = (raw) =>
  crypto.createHash("sha256").update(String(raw), "utf8").digest("hex");

const getPrefix = (raw) => String(raw).slice(0, 8);

// Persist apiKey (plaintext) + hash + prefix
async function setUserApiKey(user) {
  const raw = generateRawApiKey();
  user.apiKey = raw; // plaintext (model should have select:false)
  user.apiKeyHash = hashApiKey(raw);
  user.apiKeyPrefix = getPrefix(raw);
  user.apiKeyCreatedAt = new Date();
  user.apiKeyRevoked = false;
  await user.save();
  return raw; // return plaintext ONCE
}

async function clearUserApiKey(user) {
  user.apiKey = null;
  user.apiKeyHash = null;
  user.apiKeyPrefix = null;
  user.apiKeyCreatedAt = null;
  user.apiKeyLastUsedAt = null;
  user.apiKeyRevoked = true;
  await user.save();
}

const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "12h" });

const sanitizeUser = (userDoc) => {
  const u = userDoc?.toObject ? userDoc.toObject() : userDoc;
  if (!u) return u;
  delete u.password;
  delete u.apiKey; // never leak plaintext apiKey inside user blob
  delete u.apiKeyHash;
  return u;
};

const isEmail = (v = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).toLowerCase());
const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
const isObjectId = (id) => mongoose.isValidObjectId(id);

const bad = (res, status, message, details) =>
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });

/* Scope filter for department_admin (ObjectId-aware) */
const scopeFilterFor = (actor) => {
  if (actor.role === "super_admin") return {};
  if (actor.role === "department_admin") return { department: actor.department || null };
  return { _id: actor._id }; // user fallback
};

const ensureDepartment = async (departmentId) => {
  if (!departmentId) return null;
  if (!isObjectId(departmentId)) return "Invalid departmentId";
  const dep = await Department.findById(departmentId).lean();
  if (!dep || dep.isActive === false) return "Department not found or inactive";
  return null;
};

const mapGoogleProfile = (p = {}) => ({
  googleId: p.sub,
  email: (p.email || "").toLowerCase(),
  name: p.name || p.email?.split("@")[0] || "Google User",
  picture: p.picture || null,
  givenName: p.given_name || null,
  familyName: p.family_name || null,
  locale: p.locale || null,
  emailVerified: !!p.email_verified
});

const upsertUserFromGoogle = async ({ profile, departmentId }) => {
  const { googleId, email, name, picture, givenName, familyName, locale, emailVerified } = mapGoogleProfile(profile);

  let user = await User.findOne({ email }).select("+apiKey");
  if (!user) {
    user = await User.create({
      name,
      email,
      googleId,
      provider: "google",
      role: "user",
      department: departmentId || null,
      picture,
      givenName,
      familyName,
      locale,
      emailVerified,
      isActive: true
    });
    logger.info("User created via Google", { email });
  } else {
    if (!user.googleId) user.googleId = googleId;
    user.provider = "google";
    if (picture) user.picture = picture;
    if (givenName) user.givenName = givenName;
    if (familyName) user.familyName = familyName;
    if (locale) user.locale = locale;
    if (typeof emailVerified === "boolean") user.emailVerified = emailVerified;
  }

  user.lastLoginAt = new Date();
  await user.save();

  // Re-fetch with +apiKey
  user = await User.findById(user._id).select("+apiKey");
  return user;
};

// OPTIONAL helper to verify ID token anywhere
async function fetchUserFromIdToken(idToken) {
  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: googleClientId
  });
  return ticket.getPayload();
}

/* ============================== AUTH ============================== */

/** Register (role=user) — email/password (unchanged) */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, departmentId, address } = req.body || {};

    const errors = [];
    if (!isNonEmpty(name)) errors.push({ field: "name", msg: "Name is required" });
    if (!isEmail(email)) errors.push({ field: "email", msg: "Valid email is required" });
    if (typeof password !== "string" || password.length < 6)
      errors.push({ field: "password", msg: "Password must be at least 6 characters" });
    if (departmentId && !isObjectId(departmentId))
      errors.push({ field: "departmentId", msg: "Invalid departmentId" });
    if (errors.length) return bad(res, 422, "Validation failed", errors);

    if (departmentId) {
      const depErr = await ensureDepartment(departmentId);
      if (depErr) return bad(res, 422, depErr);
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return bad(res, 409, "User already exists");

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "user",
      department: departmentId || null,
      provider: "local",
      address: isNonEmpty(address) ? address.trim() : null,
      isActive: true
    });

    logger.info("User registered", { email: user.email });

    return res.status(201).json({
      success: true,
      token: generateToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    logger.error("Register error", { error: error.message });
    next(error);
  }
};

/** Login — email/password (unchanged behavior) */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isEmail(email) || !isNonEmpty(password))
      return bad(res, 422, "Validation failed", [
        { field: "email", msg: "Valid email is required" },
        { field: "password", msg: "Password is required" }
      ]);

    // include +apiKey so we can return it for admins (existing behavior)
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select("+apiKey");
    if (!user) return bad(res, 400, "Invalid credentials");

    const isMatch = user.password && (await bcrypt.compare(password, user.password));
    if (!isMatch) return bad(res, 400, "Invalid credentials");

    user.lastLoginAt = new Date();

    // expose apiKey only for admins; mint if missing (existing behavior)
    let apiKeyToReturn = undefined;
    const isAdmin = ["super_admin", "department_admin"].includes(user.role);
    if (isAdmin) {
      if (!user.apiKey) {
        apiKeyToReturn = await setUserApiKey(user);
      } else {
        apiKeyToReturn = user.apiKey;
        await user.save();
      }
    } else {
      await user.save();
    }

    return res.status(200).json({
      success: true,
      token: generateToken(user),
      user: sanitizeUser(user),
      ...(apiKeyToReturn ? { apiKey: apiKeyToReturn } : {})
    });
  } catch (error) {
    logger.error("Login error", { error: error.message });
    next(error);
  }
};

/** Google login via ID token — RETURNS apiKey (no JWT) */
exports.googleAuth = async (req, res) => {
  try {
    const { idToken, departmentId, address } = req.body || {};
    if (!idToken || typeof idToken !== "string") {
      return bad(res, 422, "Validation failed", [{ field: "idToken", msg: "idToken is required" }]);
    }

    if (departmentId) {
      const depErr = await ensureDepartment(departmentId);
      if (depErr) return bad(res, 422, depErr);
    }

    // Verify Google ID token (OIDC)
    const ticket = await oauth2Client.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload() || {};
    if (!isEmail(payload.email)) return bad(res, 401, "Google authentication failed");

    let user = await upsertUserFromGoogle({ profile: payload, departmentId });

    if (address && typeof address === "string") {
      user.address = address.trim();
      await user.save();
      user = await User.findById(user._id).select("+apiKey");
    }

    // Ensure per-user API key exists
    let apiKeyToReturn = user.apiKey;
    if (!apiKeyToReturn) apiKeyToReturn = await setUserApiKey(user);

    return res.status(200).json({ success: true, apiKey: apiKeyToReturn, user: sanitizeUser(user) });
  } catch (error) {
    logger.error("Google auth error", { error: error.message });
    return bad(res, 401, "Google authentication failed");
  }
};

/** Google OAuth Code → id_token — RETURNS apiKey (no JWT)
 *  Body: { code, redirectUri? }
 */
exports.googleVerifyCode = async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};
    if (!code || typeof code !== "string") {
      return bad(res, 422, "Validation failed", [{ field: "code", msg: "authorization code is required" }]);
    }

    const params = {
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri || googleRedirectUri
    };

    const tokenResp = await axios.post("https://oauth2.googleapis.com/token", null, { params });
    const idToken = tokenResp.data?.id_token;
    if (!idToken) return bad(res, 401, "Google authentication failed", [{ msg: "No id_token in token response" }]);

    const ticket = await oauth2Client.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload() || {};
    if (!isEmail(payload.email)) return bad(res, 401, "Google authentication failed");

    let user = await upsertUserFromGoogle({ profile: payload, departmentId: null });

    let apiKeyToReturn = user.apiKey;
    if (!apiKeyToReturn) apiKeyToReturn = await setUserApiKey(user);

    return res.status(200).json({ success: true, apiKey: apiKeyToReturn, user: sanitizeUser(user) });
  } catch (err) {
    logger.error("googleVerifyCode error", { error: err?.response?.data || err.message });
    return bad(res, 401, "Google authentication failed");
  }
};

/** Create a consent URL (kept if you still use redirect flow somewhere) */
exports.getGoogleAuthUrl = async (req, res) => {
  try {
    const state = req.query.state || "";
    const departmentId = req.query.departmentId || "";
    const scopes = [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      state: JSON.stringify({ state, departmentId })
    });

    return res.status(200).json({ success: true, url });
  } catch (err) {
    logger.error("getGoogleAuthUrl error", { error: err.message });
    return bad(res, 500, "Failed to create Google auth URL");
  }
};

/** OAuth redirect callback (kept; returns JWT historically) */
exports.googleOAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query || {};
    if (!isNonEmpty(code)) return bad(res, 400, "Missing authorization code");

    const parsedState = (() => {
      try { return state ? JSON.parse(state) : {}; } catch { return {}; }
    })();

    const departmentId = parsedState.departmentId || null;
    if (departmentId) {
      const depErr = await ensureDepartment(departmentId);
      if (depErr) return bad(res, 422, depErr);
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const { data: profile } = await oauth2Client.request({
      url: "https://www.googleapis.com/oauth2/v3/userinfo"
    });

    if (!isEmail(profile.email)) return bad(res, 401, "Google authentication failed");

    // For consistency, we can also return apiKey here (optional)
    let user = await upsertUserFromGoogle({ profile, departmentId });
    let apiKeyToReturn = user.apiKey;
    if (!apiKeyToReturn) apiKeyToReturn = await setUserApiKey(user);

    return res.status(200).json({
      success: true,
      apiKey: apiKeyToReturn,
      user: sanitizeUser(user)
    });
  } catch (err) {
    logger.error("googleOAuthCallback error", { error: err.message });
    return bad(res, 401, "Google authentication failed");
  }
};

/** Current principal (works with apiKeyGate attaching req.user) */
exports.me = async (req, res) => {
  return res.status(200).json({ success: true, user: sanitizeUser(req.user) });
};

/** Logout (client clears credential) */
exports.logout = async (_req, res) => {
  return res.status(200).json({ success: true, message: "Logged out" });
};

/* ============================== ADMIN ============================= */

exports.adminCreateUser = async (req, res, next) => {
  try {
    const { name, email, password, role = "user", departmentId, address, picture } = req.body || {};

    const errors = [];
    if (!isNonEmpty(name)) errors.push({ field: "name", msg: "Name is required" });
    if (!isEmail(email)) errors.push({ field: "email", msg: "Valid email is required" });
    if (password && password.length < 6) errors.push({ field: "password", msg: "Password must be at least 6 characters" });
    if (role && !["super_admin", "department_admin", "user"].includes(role))
      errors.push({ field: "role", msg: "Invalid role" });

    if (req.user.role === "department_admin" && role !== "user") {
      errors.push({ field: "role", msg: "Department admin can only create users" });
    }

    if (req.user.role === "super_admin" && role === "department_admin" && !departmentId) {
      errors.push({ field: "departmentId", msg: "departmentId is required for department_admin" });
    }

    if (departmentId) {
      if (!isObjectId(departmentId)) errors.push({ field: "departmentId", msg: "Invalid departmentId" });
      else {
        const depErr = await ensureDepartment(departmentId);
        if (depErr) errors.push({ field: "departmentId", msg: depErr });
      }
    }

    if (errors.length) return bad(res, 422, "Validation failed", errors);

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return bad(res, 409, "User already exists");

    let finalRole = role;
    let finalDeptId = null;

    if (req.user.role === "department_admin") {
      finalRole = "user";
      finalDeptId = req.user.department || null;
    } else {
      if (role === "department_admin") finalDeptId = departmentId;
      else finalDeptId = departmentId || null;
    }

    const hashed = password ? await bcrypt.hash(password, 12) : undefined;

    let user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
      role: finalRole,
      department: finalDeptId,
      provider: password ? "local" : "google",
      address: isNonEmpty(address) ? address.trim() : null,
      picture: isNonEmpty(picture) ? picture.trim() : null,
      isActive: true
    });

    // Generate & store API key always for admins and optionally for users
    user = await User.findById(user._id).select("+apiKey");
    const plaintextApiKey = await setUserApiKey(user);

    return res.status(201).json({
      success: true,
      data: sanitizeUser(user),
      apiKey: plaintextApiKey // shown once
    });
  } catch (error) {
    logger.error("adminCreateUser error", { error: error.message });
    next(error);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;
    const sort = (req.query.sort || "-createdAt").split(",").join(" ");

    const filter = scopeFilterFor(req.user);
    if (req.query.role) filter.role = req.query.role;
    if (req.query.departmentId) {
      if (!isObjectId(req.query.departmentId)) return bad(res, 422, "Invalid departmentId");
      filter.department = req.query.departmentId;
    }
    if (req.query.q) filter.name = { $regex: req.query.q, $options: "i" };
    if (typeof req.query.isActive !== "undefined") filter.isActive = req.query.isActive === "true";

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-password")
        .populate("department", "id code name shortcode")
        .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      meta: { total, page, limit, hasMore: skip + items.length < total },
      data: items
    });
  } catch (error) {
    logger.error("listUsers error", { error: error.message });
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Validation failed", [{ field: "id", msg: "Invalid user id" }]);

    const target = await User.findById(id).select("-password");
    if (!target) return bad(res, 404, "User not found");

    if (req.user.role === "department_admin" &&
        String(target.department || "") !== String(req.user.department || "")) {
      return bad(res, 403, "Forbidden");
    }
    if (req.user.role === "user" && String(target._id) !== String(req.user._id)) {
      return bad(res, 403, "Forbidden");
    }

    return res.status(200).json({ success: true, data: sanitizeUser(target) });
  } catch (error) {
    logger.error("getUser error", { error: error.message });
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Validation failed", [{ field: "id", msg: "Invalid user id" }]);

    const target = await User.findById(id).select("+apiKey");
    if (!target) return bad(res, 404, "User not found");

    // Scope checks
    if (req.user.role === "department_admin" &&
        String(target.department || "") !== String(req.user.department || "")) {
      return bad(res, 403, "Forbidden");
    }
    if (req.user.role === "user" && String(target._id) !== String(req.user._id)) {
      return bad(res, 403, "Forbidden");
    }

    const { name, password, role, departmentId, isActive, address, picture } = req.body || {};

    if (typeof name === "string" && isNonEmpty(name)) target.name = name.trim();
    if (typeof address === "string") target.address = address.trim() || null;
    if (typeof picture === "string") target.picture = picture.trim() || null;

    if (typeof password === "string" && password.length) {
      if (req.user.role !== "super_admin" && String(target._id) !== String(req.user._id))
        return bad(res, 403, "Only self or super admin can change password");
      if (password.length < 6)
        return bad(res, 422, "Validation failed", [{ field: "password", msg: "Min length 6" }]);
      target.password = await bcrypt.hash(password, 12);
    }

    if (req.user.role === "super_admin") {
      if (role && !["super_admin", "department_admin", "user"].includes(role))
        return bad(res, 422, "Validation failed", [{ field: "role", msg: "Invalid role" }]);
      if (role) target.role = role;

      if (typeof departmentId !== "undefined") {
        if (departmentId === null || departmentId === "") {
          target.department = null;
        } else {
          if (!isObjectId(departmentId)) return bad(res, 422, "Invalid departmentId");
          const depErr = await ensureDepartment(departmentId);
          if (depErr) return bad(res, 422, depErr);
          target.department = departmentId;
        }
      }
      if (typeof isActive !== "undefined") target.isActive = !!isActive;
    } else if (req.user.role === "department_admin") {
      if (role && role !== target.role) return bad(res, 403, "Dept admin cannot change roles");
      if (typeof departmentId !== "undefined" &&
          String(departmentId || "") !== String(target.department || "")) {
        return bad(res, 403, "Dept admin cannot reassign departments");
      }
      if (typeof isActive !== "undefined") target.isActive = !!isActive;
    }

    await target.save();

    return res.status(200).json({ success: true, data: sanitizeUser(target) });
  } catch (error) {
    logger.error("updateUser error", { error: error.message });
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params || {};
    if (!isObjectId(id)) return bad(res, 422, "Validation failed", [{ field: "id", msg: "Invalid user id" }]);

    const target = await User.findById(id);
    if (!target) return bad(res, 404, "User not found");

    if (req.user.role === "user") return bad(res, 403, "Forbidden");
    if (req.user.role === "department_admin" &&
        String(target.department || "") !== String(req.user.department || "")) {
      return bad(res, 403, "Forbidden");
    }

    target.isActive = false;
    await target.save();

    return res.status(200).json({ success: true, message: "User deactivated" });
  } catch (error) {
    logger.error("deleteUser error", { error: error.message });
    next(error);
  }
};

/* ============================== API KEY MGMT ============================= */

exports.rotateApiKey = async (req, res) => {
  const targetId = req.params.userId || req.user._id;
  if (!isObjectId(targetId)) return bad(res, 422, "Invalid user id");

  const target = await User.findById(targetId).select("+apiKey");
  if (!target) return bad(res, 404, "User not found");

  if (req.user.role === "department_admin" &&
      String(target.department || "") !== String(req.user.department || "")) {
    return bad(res, 403, "Forbidden");
  }
  if (req.user.role === "user" && String(target._id) !== String(req.user._id)) {
    return bad(res, 403, "Forbidden");
  }

  const plaintext = await setUserApiKey(target);
  return res.status(200).json({ success: true, apiKey: plaintext });
};

exports.revokeApiKey = async (req, res) => {
  const targetId = req.params.userId || req.user._id;
  if (!isObjectId(targetId)) return bad(res, 422, "Invalid user id");

  const target = await User.findById(targetId).select("+apiKey");
  if (!target) return bad(res, 404, "User not found");

  if (req.user.role === "department_admin" &&
      String(target.department || "") !== String(req.user.department || "")) {
    return bad(res, 403, "Forbidden");
  }
  if (req.user.role === "user" && String(target._id) !== String(req.user._id)) {
    return bad(res, 403, "Forbidden");
  }

  await clearUserApiKey(target);
  return res.status(200).json({ success: true, message: "API key revoked" });
};

/* ===== Optional exports for testing/helpers ===== */
exports._fetchUserFromIdToken = fetchUserFromIdToken;
