const express = require("express");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const authController = require("../controllers/authController");

const router = express.Router();

/* ===== Public Auth ===== */
router.post("/register", authController.register);   // self sign-up (role=user)
router.post("/login", authController.login);         // email/password
router.post("/google", authController.googleAuth);   // { idToken, department? }

/* ===== Session ===== */
router.get("/me", auth, authController.me);
router.post("/logout", auth, authController.logout);

/* ===== Admin CRUD ===== */
router.post("/users",  auth, authorize("super_admin", "department_admin"), authController.adminCreateUser);
router.get("/users",   auth, authorize("super_admin", "department_admin"), authController.listUsers);
router.get("/users/:id", auth, authorize("super_admin", "department_admin", "user"), authController.getUser);
router.patch("/users/:id", auth, authorize("super_admin", "department_admin", "user"), authController.updateUser);
router.delete("/users/:id", auth, authorize("super_admin", "department_admin"), authController.deleteUser);

module.exports = router;
