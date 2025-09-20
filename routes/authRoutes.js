const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const authorize = require("../middleware/authorize");
const ctrl = require("../controllers/authController");

const router = express.Router();

// All routes require x-api-key (global OR user API key)
router.use(apiKeyGate);

/* Public Auth (email/password still returns JWT if you kept it) */
router.post("/register", ctrl.register);
router.post("/login", ctrl.login);

/* Google flows → return per-user API key */
router.post("/google", ctrl.googleAuth);
router.post("/oauth/google/verify", ctrl.googleVerifyCode);

/* Session (works when apiKeyGate attaches req.user from user API key) */
router.get("/me", ctrl.me);
router.post("/logout", ctrl.logout);

/* Admin CRUD */
router.post("/users", authorize("super_admin", "department_admin"), ctrl.adminCreateUser);
router.get("/users", authorize("super_admin", "department_admin"), ctrl.listUsers);
router.get("/users/:id", authorize("super_admin", "department_admin", "user"), ctrl.getUser);
router.patch("/users/:id", authorize("super_admin", "department_admin", "user"), ctrl.updateUser);
router.delete("/users/:id", authorize("super_admin", "department_admin"), ctrl.deleteUser);

module.exports = router;
