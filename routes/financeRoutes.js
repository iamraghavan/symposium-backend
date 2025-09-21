// routes/v1/financeRoutes.js
const express = require("express");
const apiKeyGate = require("../middleware/apiKey");
const authorize = require("../middleware/authorize");
const finance = require("../controllers/finance/financeController");

const router = express.Router();
router.use(apiKeyGate);

router.get("/finance/overview", authorize("super_admin"), finance.overview);
router.get("/finance/transactions", authorize("super_admin"), finance.transactions);
router.get("/finance/revenue-by-department", authorize("super_admin"), finance.revenueByDepartment); // optional

module.exports = router;
