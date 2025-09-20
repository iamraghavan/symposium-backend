const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const authorize = require("../middleware/authorize");
const authController = require("../controllers/authController");

const router = express.Router();

// All routes require x-api-key (global OR user API key)
router.use(apiKeyGate);

/* ===== Public Auth ===== */
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/google", authController.googleAuth);

/* ===== Session ===== */
router.get("/me", authController.me);
router.post("/logout", authController.logout);

/* ===== Admin CRUD ===== */
router.post("/users", authorize("super_admin", "department_admin"), authController.adminCreateUser);
router.get("/users", authorize("super_admin", "department_admin"), authController.listUsers);
router.get("/users/:id", authorize("super_admin", "department_admin", "user"), authController.getUser);
router.patch("/users/:id", authorize("super_admin", "department_admin", "user"), authController.updateUser);
router.delete("/users/:id", authorize("super_admin", "department_admin"), authController.deleteUser);

module.exports = router;
