const CRITICAL_KEYWORDS = [
  "fraud",
  "hacked",
  "security breach",
  "lawsuit",
  "legal",
  "chargeback",
  "scam",
  "police",
];

const URGENCY_KEYWORDS = ["urgent", "asap", "immediately"];

function containsKeyword(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function applyBusinessRules(originalMessage, aiResponse) {
  const result = { ...aiResponse };

  if (containsKeyword(originalMessage, CRITICAL_KEYWORDS)) {
    result.priority = "P0";
  }

  if (containsKeyword(originalMessage, URGENCY_KEYWORDS) && result.priority === "P3") {
    result.priority = "P1";
  }

  return result;
}

module.exports = { applyBusinessRules };
