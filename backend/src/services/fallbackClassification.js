const { logInfo } = require("../utils/logger");

const LOW_CONFIDENCE_THRESHOLD = 0.7;

function extractConfidence(response) {
  if (response === null || typeof response !== "object" || Array.isArray(response)) {
    return 0;
  }

  const raw = response.confidence;

  if (typeof raw !== "number" || Number.isNaN(raw)) {
    return 0;
  }

  if (raw >= 0 && raw <= 1) {
    return raw;
  }

  return 0;
}

function buildFallbackResponse(confidence = 0) {
  return {
    category: "Other",
    priority: "P3",
    sentiment: "Neutral",
    summary: "The request could not be classified confidently.",
    suggested_action: "Route the request to a human support agent.",
    needs_human: true,
    confidence,
  };
}

function shouldUseFallback(response, validation) {
  if (!validation.valid) {
    return true;
  }

  return validation.data.confidence < LOW_CONFIDENCE_THRESHOLD;
}

function resolveClassification(response, validation, reason) {
  if (!shouldUseFallback(response, validation)) {
    return null;
  }

  const confidence = validation.valid
    ? validation.data.confidence
    : extractConfidence(response);

  logInfo("Fallback classification applied", { reason, confidence });

  return buildFallbackResponse(confidence);
}

module.exports = {
  LOW_CONFIDENCE_THRESHOLD,
  buildFallbackResponse,
  extractConfidence,
  resolveClassification,
  shouldUseFallback,
};
