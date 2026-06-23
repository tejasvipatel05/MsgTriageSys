const { loadRawDataset } = require("../data/datasetLoader");
const { normalizeDataset } = require("../data/datasetNormalizer");
const { logInfo, logError } = require("../utils/logger");

let cachedDataset = null;
let loadAttempted = false;

function getDataset() {
  if (loadAttempted) {
    return cachedDataset;
  }

  loadAttempted = true;
  const startedAt = Date.now();

  const rawRows = loadRawDataset();

  if (rawRows.length === 0) {
    cachedDataset = [];
    logInfo("Dataset loaded", {
      recordCount: 0,
      durationMs: Date.now() - startedAt,
    });
    return cachedDataset;
  }

  try {
    cachedDataset = normalizeDataset(rawRows);
    logInfo("Dataset loaded", {
      recordCount: cachedDataset.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    cachedDataset = [];
    logError("Failed to normalize dataset", { message: err.message });
    logInfo("Dataset loaded", {
      recordCount: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  return cachedDataset;
}

module.exports = { getDataset };
