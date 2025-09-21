// routes/v1/financeRoutes.js
const express = require("express");
const finance = require("../controllers/finance/financeController");
const { publicLimiter, cacheMinutes } = require("../middleware/publicGuards");

const router = express.Router();

router.use(publicLimiter);

router.get("/overview", cacheMinutes(1), finance.overview);
router.get("/transactions", cacheMinutes(1), finance.transactions);
router.get("/revenue-by-department", cacheMinutes(1), finance.revenueByDepartment); // optional

module.exports = router;
