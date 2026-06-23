require("dotenv").config();

const app = require("./src/app");
const { getDataset } = require("./src/services/datasetService");
const { logError, logInfo } = require("./src/utils/logger");

const PORT = process.env.PORT || 5000;

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logError("Unhandled promise rejection", { message });
});

process.on("uncaughtException", (err) => {
  logError("Uncaught exception", { message: err.message });
});

getDataset();

app.listen(PORT, () => {
  const aiProvider = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  logInfo("Server started", {
    url: `http://localhost:${PORT}`,
    aiProvider,
  });
});
