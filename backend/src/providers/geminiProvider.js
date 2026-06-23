const { logInfo, logError } = require("../utils/logger");
const { retryAsync } = require("../utils/retry");

const DEFAULT_MODEL = "gemini-2.5-flash";
const RETRY_DELAYS_MS = [500, 1000];
const MAX_ATTEMPTS = 3;
const SERVICE_UNAVAILABLE_MESSAGE =
  "AI service is temporarily unavailable. Please try again.";

function getReadableError(err) {
  if (err.message === "GEMINI_API_KEY is not configured") {
    return err.message;
  }

  if (err.message === "Gemini returned invalid JSON") {
    return err.message;
  }

  const apiKeyMatch = err.message.match(/API key not valid/i);
  if (apiKeyMatch) {
    return "Gemini API key is invalid or missing";
  }

  return "Gemini API request failed";
}

function extractFailureCode(err) {
  const message = err.message || "";
  const statusMatch = message.match(/\[(429|503)[^\]]*\]/);

  if (statusMatch) {
    return statusMatch[1];
  }

  if (err.code) {
    return err.code;
  }

  return "error";
}

function isRetryableError(err) {
  const message = err.message || "";
  const code = err.code;

  if (message === "GEMINI_API_KEY is not configured") {
    return false;
  }

  if (message === "Gemini returned invalid JSON") {
    return false;
  }

  if (/API key not valid|API_KEY_INVALID/i.test(message)) {
    return false;
  }

  if (/\[503\]|\b503\b|Service Unavailable/i.test(message)) {
    return true;
  }

  if (/\[429\]|Too Many Requests|\b429\b/i.test(message)) {
    return true;
  }

  if (code === "ECONNRESET" || code === "ETIMEDOUT") {
    return true;
  }

  if (/ECONNRESET|ETIMEDOUT|network timeout|fetch failed/i.test(message)) {
    return true;
  }

  return false;
}

function parseJsonResponse(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
}

async function makeGeminiRequest(prompt, modelName, apiKey) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return parseJsonResponse(text);
}

async function analyze(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const startTime = Date.now();

  logInfo("AI request started", { model: modelName, provider: "gemini" });

  try {
    const parsed = await retryAsync(
      () => makeGeminiRequest(prompt, modelName, apiKey),
      {
        maxAttempts: MAX_ATTEMPTS,
        delays: RETRY_DELAYS_MS,
        isRetryable: isRetryableError,
        onRetry: (err, attempt, delay, maxAttempts) => {
          logInfo(`Gemini request failed (${extractFailureCode(err)})`);
          logInfo(`Retry ${attempt}/${maxAttempts} in ${delay} ms`);
        },
      }
    );

    logInfo("AI request completed", {
      durationMs: Date.now() - startTime,
      provider: "gemini",
    });

    return parsed;
  } catch (err) {
    logError("AI request failed", {
      durationMs: Date.now() - startTime,
      message: err.message,
    });

    if (isRetryableError(err)) {
      logInfo("Retries exhausted");
      throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
    }

    throw new Error(getReadableError(err));
  }
}

module.exports = { analyze };
