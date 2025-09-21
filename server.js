const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

// --- Swagger UI & OpenAPI JSON ---
const swaggerUi = require("swagger-ui-express");
const openapi = require("./docs/openapi");

const errorHandler = require("./middleware/errorHandler");
const acceptJson = require("./middleware/acceptJson");
const apiKeyGate = require("./middleware/apiKey");
const analyticsRoutes = require("./routes/analyticsRoutes");
const financeRoutes   = require("./routes/financeRoutes");
const app = express();

/* ---- Security & Core Middleware ---- */
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

/* ---- Health (open; add apiKeyGate if you want it locked) ---- */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), version: "v1" });
});




app.use("/api/v1/openapi.json", (_req, res) => res.status(200).json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi, {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true, // keep apiKey/JWT in UI across refresh
  }
}));

app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/finance",   financeRoutes);



app.use("/api", acceptJson);
app.use("/api", apiKeyGate);
app.use("/api/v1", require("./routes/v1")); // <-- versioned router root

/* ---- 404 for other API paths ---- */
app.use("/api", (_req, res) => res.status(404).json({ success: false, message: "Not Found" }));

/* ---- Error Handler ---- */
app.use(errorHandler);

module.exports = app;
