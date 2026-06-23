const { logInfo } = require("../utils/logger");

function getProviderName() {
  return (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
}

function resolveProvider() {
  const providerName = getProviderName();

  if (providerName === "groq") {
    return require("./groqProvider");
  }

  if (providerName !== "gemini") {
    logInfo("Unknown AI_PROVIDER, falling back to gemini", { provider: providerName });
  }

  return require("./geminiProvider");
}

async function analyze(prompt) {
  const providerName = getProviderName();
  logInfo("AI provider selected", { provider: providerName });
  return resolveProvider().analyze(prompt);
}

module.exports = { analyze };
