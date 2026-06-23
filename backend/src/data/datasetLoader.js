const fs = require("fs");
const path = require("path");
const { logError } = require("../utils/logger");

const DATASET_PATH = path.join(__dirname, "../../data/customer_interactions.csv");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  if (headers.length === 0 || headers.every((header) => header.length === 0)) {
    throw new Error("CSV header row is missing or invalid");
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, columnIndex) => {
      row[header] = values[columnIndex] ?? "";
    });

    row.__rowNumber = index + 2;
    return row;
  });
}

function loadRawDataset() {
  if (!fs.existsSync(DATASET_PATH)) {
    logError("Dataset file not found", { path: DATASET_PATH });
    return [];
  }

  let content;

  try {
    content = fs.readFileSync(DATASET_PATH, "utf8");
  } catch (err) {
    logError("Failed to read dataset file", { message: err.message });
    return [];
  }

  if (!content.trim()) {
    logError("Dataset file is empty", { path: DATASET_PATH });
    return [];
  }

  try {
    return parseCsv(content);
  } catch (err) {
    logError("Failed to parse dataset CSV", { message: err.message });
    return [];
  }
}

module.exports = { loadRawDataset };
