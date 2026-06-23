const CONFIDENCE_THRESHOLD = 0.7;

function evaluateNeedsHuman(response, { promptGuardBlocked = false } = {}) {
  if (promptGuardBlocked) {
    return true;
  }

  if (response.confidence < CONFIDENCE_THRESHOLD) {
    return true;
  }

  if (response.priority === "P0") {
    return true;
  }

  if (response.category === "Other") {
    return true;
  }

  return response.needs_human;
}

function applyDecisionEngine(response, options = {}) {
  return {
    ...response,
    needs_human: evaluateNeedsHuman(response, options),
  };
}

module.exports = { applyDecisionEngine, evaluateNeedsHuman };
