const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const ctrl = require("../controllers/registrationController");

const router = express.Router();

router.use(apiKeyGate);

// Create a registration (individual or team)
router.post("/", ctrl.create);

// My registrations (per-user)
router.get("/my", ctrl.listMine);

// Get a registration by id (owner or admins)
router.get("/:id", ctrl.getById);

module.exports = router;
