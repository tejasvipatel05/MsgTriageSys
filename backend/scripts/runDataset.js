require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs").promises;
const path = require("path");
const { analyzeMessage } = require("../src/services/analyzeService");

const BACKEND_ROOT = path.join(__dirname, "..");
const DATASET_PATH = path.join(BACKEND_ROOT, "dataset", "demoDataset.json");
const RESULTS_DIR = path.join(BACKEND_ROOT, "results");
const JSON_OUTPUT = path.join(RESULTS_DIR, "latest-results.json");
const CSV_OUTPUT = path.join(RESULTS_DIR, "latest-results.csv");

function escapeCsvField(value) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildSuccessResult(id, message, result, processingTimeMs) {
  return {
    id,
    message,
    category: result.category,
    priority: result.priority,
    confidence: result.confidence,
    needs_human: result.needs_human,
    processingTimeMs,
  };
}

function buildErrorResult(id, message, error, processingTimeMs) {
  return {
    id,
    message,
    error: error || "Unexpected server error",
    processingTimeMs,
  };
}

function calculateStatistics(results) {
  const successful = results.filter((row) => !row.error);
  const failed = results.filter((row) => row.error);

  const processingTimes = results
    .map((row) => row.processingTimeMs)
    .filter((value) => typeof value === "number");

  const confidences = successful
    .map((row) => row.confidence)
    .filter((value) => typeof value === "number");

  const categoryDistribution = {};
  const priorityDistribution = {};

  for (const row of successful) {
    categoryDistribution[row.category] = (categoryDistribution[row.category] || 0) + 1;
    priorityDistribution[row.priority] = (priorityDistribution[row.priority] || 0) + 1;
  }

  const needsHumanCount = successful.filter((row) => row.needs_human === true).length;

  const average = (values) =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    totalMessages: results.length,
    successful: successful.length,
    failed: failed.length,
    averageProcessingTimeMs: Math.round(average(processingTimes)),
    minProcessingTimeMs: processingTimes.length === 0 ? 0 : Math.min(...processingTimes),
    maxProcessingTimeMs: processingTimes.length === 0 ? 0 : Math.max(...processingTimes),
    averageConfidence: Number(average(confidences).toFixed(2)),
    needsHumanCount,
    categoryDistribution,
    priorityDistribution,
  };
}

function buildCsv(results) {
  const header = [
    "ID",
    "Message",
    "Category",
    "Priority",
    "Confidence",
    "Needs Human",
    "Processing Time (ms)",
  ].join(",");

  const rows = results.map((row) => {
    if (row.error) {
      return [
        row.id,
        row.message,
        `ERROR: ${row.error}`,
        "",
        "",
        "",
        row.processingTimeMs,
      ]
        .map(escapeCsvField)
        .join(",");
    }

    return [
      row.id,
      row.message,
      row.category,
      row.priority,
      row.confidence,
      row.needs_human ? "Yes" : "No",
      row.processingTimeMs,
    ]
      .map(escapeCsvField)
      .join(",");
  });

  return [header, ...rows].join("\n") + "\n";
}

function printSummary(stats) {
  const divider = "=====================================";

  console.log(divider);
  console.log("Dataset Processing Complete");
  console.log(divider);
  console.log("");
  console.log(`Messages Processed : ${stats.totalMessages}`);
  console.log(`Successful       : ${stats.successful}`);
  console.log(`Failed           : ${stats.failed}`);
  console.log(`Average Latency  : ${stats.averageProcessingTimeMs} ms`);
  console.log(`Min Latency      : ${stats.minProcessingTimeMs} ms`);
  console.log(`Max Latency      : ${stats.maxProcessingTimeMs} ms`);
  console.log(`Average Confidence : ${stats.averageConfidence}`);
  console.log(`Needs Human      : ${stats.needsHumanCount}`);
  console.log("");
  console.log("Category Distribution");
  console.log("");

  const sortedCategories = Object.entries(stats.categoryDistribution).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  for (const [category, count] of sortedCategories) {
    console.log(`${category} : ${count}`);
  }

  console.log("");
  console.log("Priority Distribution");
  console.log("");

  const sortedPriorities = Object.entries(stats.priorityDistribution).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  for (const [priority, count] of sortedPriorities) {
    console.log(`${priority} : ${count}`);
  }

  console.log("");
  console.log(divider);
}

async function processDataset() {
  const raw = await fs.readFile(DATASET_PATH, "utf8");
  const dataset = JSON.parse(raw);

  if (!Array.isArray(dataset)) {
    throw new Error("Dataset must be a JSON array");
  }

  const results = [];

  for (const item of dataset) {
    const itemStart = Date.now();
    const { id, message } = item;

    try {
      const result = await analyzeMessage(message);
      results.push(
        buildSuccessResult(id, message, result, Date.now() - itemStart)
      );
    } catch (err) {
      results.push(
        buildErrorResult(id, message, err.message, Date.now() - itemStart)
      );
    }
  }

  const stats = calculateStatistics(results);

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(JSON_OUTPUT, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  await fs.writeFile(CSV_OUTPUT, buildCsv(results), "utf8");

  printSummary(stats);

  console.log("");
  console.log(`JSON report saved to ${JSON_OUTPUT}`);
  console.log(`CSV report saved to ${CSV_OUTPUT}`);
}

processDataset().catch((err) => {
  console.error("Dataset processing failed:", err.message);
  process.exit(1);
});
