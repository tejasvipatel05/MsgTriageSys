const fs = require("fs").promises;
const path = require("path");

const BACKEND_ROOT = path.join(__dirname, "..");
const RESULTS_PATH = path.join(BACKEND_ROOT, "results", "latest-results.json");
const GROUND_TRUTH_PATH = path.join(BACKEND_ROOT, "evaluation", "groundTruth.json");
const REPORT_PATH = path.join(BACKEND_ROOT, "evaluation", "evaluationReport.json");

function toPercent(correct, total) {
  if (total === 0) {
    return 0;
  }

  return Math.round((correct / total) * 100);
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMismatchReasons(expected, predicted) {
  if (predicted.error) {
    return ["Prediction failed"];
  }

  const reasons = [];

  if (predicted.category !== expected.expectedCategory) {
    reasons.push("Category mismatch");
  }

  if (predicted.priority !== expected.expectedPriority) {
    reasons.push("Priority mismatch");
  }

  if (predicted.needs_human !== expected.expectedNeedsHuman) {
    reasons.push("Needs human mismatch");
  }

  return reasons;
}

function buildFailureRecord(expected, predicted) {
  return {
    id: expected.id,
    expected: {
      category: expected.expectedCategory,
      priority: expected.expectedPriority,
      needsHuman: expected.expectedNeedsHuman,
    },
    predicted: {
      category: predicted.category ?? null,
      priority: predicted.priority ?? null,
      needsHuman: predicted.needs_human ?? null,
      confidence: predicted.confidence ?? null,
    },
    reasons: getMismatchReasons(expected, predicted),
  };
}

function printConsoleReport(report, groundTruthCount) {
  const divider = "==================================================";

  console.log(divider);
  console.log("AI TRIAGE EVALUATION REPORT");
  console.log(divider);
  console.log("");
  console.log(`Ground Truth Records : ${groundTruthCount}`);
  console.log(`Category Accuracy    : ${report.categoryAccuracy}%`);
  console.log(`Priority Accuracy    : ${report.priorityAccuracy}%`);
  console.log(`Needs Human Accuracy : ${report.needsHumanAccuracy}%`);
  console.log(`Average Confidence   : ${report.averageConfidence}`);
  console.log(`Average Latency      : ${report.averageLatencyMs} ms`);
  console.log("");
  console.log(`Incorrect Predictions : ${report.failures.length}`);
  console.log("");

  for (const failure of report.failures) {
    console.log("---");
    console.log(`ID ${failure.id}`);
    console.log(`Expected Category: ${failure.expected.category}`);
    console.log(`Expected Priority: ${failure.expected.priority}`);
    console.log(`Expected Needs Human: ${failure.expected.needsHuman}`);

    if (failure.predicted.category === null && failure.predicted.priority === null) {
      console.log("Predicted: [failed - no prediction available]");
    } else {
      console.log(`Predicted Category: ${failure.predicted.category}`);
      console.log(`Predicted Priority: ${failure.predicted.priority}`);
      console.log(`Predicted Needs Human: ${failure.predicted.needsHuman}`);
    }

    console.log(`Reason: ${failure.reasons.join(", ")}`);
    console.log("");
  }

  console.log(divider);
}

async function evaluate() {
  const [resultsRaw, groundTruthRaw] = await Promise.all([
    fs.readFile(RESULTS_PATH, "utf8"),
    fs.readFile(GROUND_TRUTH_PATH, "utf8"),
  ]);

  const results = JSON.parse(resultsRaw);
  const groundTruth = JSON.parse(groundTruthRaw);

  if (!Array.isArray(results)) {
    throw new Error("Results file must contain a JSON array");
  }

  if (!Array.isArray(groundTruth)) {
    throw new Error("Ground truth file must contain a JSON array");
  }

  const resultsById = new Map(results.map((row) => [row.id, row]));

  let totalEvaluated = 0;
  let correctCategory = 0;
  let correctPriority = 0;
  let correctNeedsHuman = 0;
  const failures = [];
  const confidences = [];
  const latencies = [];

  for (const expected of groundTruth) {
    const predicted = resultsById.get(expected.id);

    if (!predicted) {
      continue;
    }

    totalEvaluated += 1;
    latencies.push(
      typeof predicted.processingTimeMs === "number" ? predicted.processingTimeMs : 0
    );

    const reasons = getMismatchReasons(expected, predicted);

    if (predicted.error) {
      failures.push(buildFailureRecord(expected, predicted));
      continue;
    }

    if (typeof predicted.confidence === "number") {
      confidences.push(predicted.confidence);
    }

    if (predicted.category === expected.expectedCategory) {
      correctCategory += 1;
    }

    if (predicted.priority === expected.expectedPriority) {
      correctPriority += 1;
    }

    if (predicted.needs_human === expected.expectedNeedsHuman) {
      correctNeedsHuman += 1;
    }

    if (reasons.length > 0) {
      failures.push(buildFailureRecord(expected, predicted));
    }
  }

  const report = {
    totalEvaluated,
    correctCategory,
    correctPriority,
    correctNeedsHuman,
    categoryAccuracy: toPercent(correctCategory, totalEvaluated),
    priorityAccuracy: toPercent(correctPriority, totalEvaluated),
    needsHumanAccuracy: toPercent(correctNeedsHuman, totalEvaluated),
    averageConfidence: Number(average(confidences).toFixed(2)),
    averageLatencyMs: Math.round(average(latencies)),
    failures,
  };

  await fs.mkdir(path.join(BACKEND_ROOT, "evaluation"), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  printConsoleReport(report, groundTruth.length);

  console.log("");
  console.log(`Report saved to ${REPORT_PATH}`);
}

evaluate().catch((err) => {
  console.error("Evaluation failed:", err.message);
  process.exit(1);
});
