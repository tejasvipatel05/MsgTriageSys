const {
  CANONICAL_CATEGORIES,
  normalizeCategory,
} = require("../constants/categories");

const ALLOWED_PRIORITIES = ["P0", "P1", "P2", "P3"];

const REQUIRED_FIELDS = [
  "category",
  "priority",
  "summary",
  "suggested_action",
  "needs_human",
  "confidence",
];

function validateAIResponse(response) {
  const errors = [];

  if (response === null || typeof response !== "object" || Array.isArray(response)) {
    return { valid: false, errors: ["Response must be an object"] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in response)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const normalizedCategory = normalizeCategory(response.category);

  if (!CANONICAL_CATEGORIES.includes(normalizedCategory)) {
    errors.push(`Invalid category: ${response.category}`);
  }

  if (!ALLOWED_PRIORITIES.includes(response.priority)) {
    errors.push(`Invalid priority: ${response.priority}`);
  }

  if (typeof response.needs_human !== "boolean") {
    errors.push("needs_human must be a boolean");
  }

  if (typeof response.confidence !== "number" || Number.isNaN(response.confidence)) {
    errors.push("confidence must be a number");
  } else if (response.confidence < 0 || response.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }

  if (typeof response.summary !== "string" || !response.summary.trim()) {
    errors.push("summary must be a non-empty string");
  }

  if (typeof response.suggested_action !== "string" || !response.suggested_action.trim()) {
    errors.push("suggested_action must be a non-empty string");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      category: normalizedCategory,
      priority: response.priority,
      summary: response.summary.trim(),
      suggested_action: response.suggested_action.trim(),
      needs_human: response.needs_human,
      confidence: response.confidence,
    },
  };
}

module.exports = { validateAIResponse };
