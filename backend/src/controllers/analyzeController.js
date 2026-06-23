const { analyzeMessage } = require("../services/analyzeService");
const { sendError } = require("../utils/errorResponse");
const { logInfo, logError } = require("../utils/logger");

async function analyze(req, res) {
  const startTime = Date.now();

  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return sendError(res, 400, "message is required and must be a string");
    }

    const result = await analyzeMessage(message);

    logInfo("Analyze request completed", {
      durationMs: Date.now() - startTime,
    });

    res.json(result);
  } catch (err) {
    logError("Analyze request failed", {
      durationMs: Date.now() - startTime,
      message: err.message,
    });

    sendError(res, 500, err.message || "Unexpected server error");
  }
}

function buildBatchSuccessResult(id, result, processingTimeMs) {
  return {
    id,
    category: result.category,
    priority: result.priority,
    summary: result.summary,
    suggested_action: result.suggested_action,
    confidence: result.confidence,
    needs_human: result.needs_human,
    processingTimeMs,
  };
}

function buildBatchErrorResult(id, error, processingTimeMs) {
  return {
    id,
    error,
    processingTimeMs,
  };
}

async function analyzeBatch(req, res) {
  const startTime = Date.now();

  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return sendError(res, 400, "messages is required and must be an array");
    }

    const results = [];
    let processed = 0;

    for (const item of messages) {
      const itemStart = Date.now();

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        results.push(
          buildBatchErrorResult(
            item?.id ?? null,
            "Each message entry must be an object with id and message",
            Date.now() - itemStart
          )
        );
        continue;
      }

      const { id, message } = item;

      if (id === undefined || id === null) {
        results.push(
          buildBatchErrorResult(
            null,
            "id is required for each message",
            Date.now() - itemStart
          )
        );
        continue;
      }

      if (!message || typeof message !== "string" || !message.trim()) {
        results.push(
          buildBatchErrorResult(
            id,
            "message is required and must be a non-empty string",
            Date.now() - itemStart
          )
        );
        continue;
      }

      try {
        const result = await analyzeMessage(message);
        processed += 1;
        results.push(
          buildBatchSuccessResult(id, result, Date.now() - itemStart)
        );
      } catch (err) {
        results.push(
          buildBatchErrorResult(
            id,
            err.message || "Unexpected server error",
            Date.now() - itemStart
          )
        );
      }
    }

    logInfo("Analyze batch request completed", {
      total: messages.length,
      processed,
      durationMs: Date.now() - startTime,
    });

    res.json({
      total: messages.length,
      processed,
      results,
    });
  } catch (err) {
    logError("Analyze batch request failed", {
      durationMs: Date.now() - startTime,
      message: err.message,
    });

    sendError(res, 500, err.message || "Unexpected server error");
  }
}

module.exports = { analyze, analyzeBatch };
