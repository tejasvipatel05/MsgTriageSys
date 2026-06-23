const { buildPrompt } = require("../prompts/promptBuilder");
const aiProvider = require("../providers/aiProvider");
const { validateAIResponse } = require("../validators/responseValidator");
const { applyBusinessRules } = require("../validators/businessRules");
const { applyDecisionEngine } = require("../decision/decisionEngine");
const { inspectPrompt } = require("../security/promptGuard");
const { resolveClassification } = require("./fallbackClassification");
const { logInfo } = require("../utils/logger");

const BLOCKED_RESPONSE = {
  category: "Other",
  priority: "P1",
  summary: "Potential prompt injection attempt detected.",
  suggested_action: "Escalate for manual review.",
  needs_human: true,
  confidence: 1.0,
};

async function analyzeMessage(message) {
  const inspection = inspectPrompt(message);

  if (inspection.blocked) {
    logInfo("Prompt injection blocked", { reason: inspection.reason });
    return applyDecisionEngine({ ...BLOCKED_RESPONSE }, { promptGuardBlocked: true });
  }

  const prompt = buildPrompt(inspection.sanitizedMessage);

  let response;

  try {
    response = await aiProvider.analyze(prompt);
  } catch (err) {
    if (/invalid json/i.test(err.message)) {
      const fallback = resolveClassification(null, { valid: false, errors: [] }, "invalid JSON");
      if (fallback) {
        return fallback;
      }
    }

    throw err;
  }

  const validation = validateAIResponse(response);

  const fallback = resolveClassification(
    response,
    validation,
    validation.valid ? "low confidence" : validation.errors.join("; ")
  );

  if (fallback) {
    return applyDecisionEngine(fallback);
  }

  const withBusinessRules = applyBusinessRules(message, validation.data);
  return applyDecisionEngine(withBusinessRules);
}

module.exports = { analyzeMessage };
