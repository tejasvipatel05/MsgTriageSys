const express = require("express");
const cors = require("cors");
const analyzeRoutes = require("./routes/analyzeRoutes");
const { sendError } = require("./utils/errorResponse");
const { logInfo, logError } = require("./utils/logger");

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logInfo("Incoming request", {
    method: req.method,
    path: req.path,
  });
  next();
});

// app.use(analyzeRoutes);
app.use("/", analyzeRoutes);

app.use((err, req, res, next) => {
  logError("Unexpected server error", { message: err.message });
  sendError(res, 500, err.message || "Unexpected server error");
});

module.exports = app;
