const { logInfo, logError } = require("../utils/logger");
const { retryAsync } = require("../utils/retry");

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const RETRY_DELAYS_MS = [500, 1000];
const MAX_ATTEMPTS = 3;
const SERVICE_UNAVAILABLE_MESSAGE =
  "AI service is temporarily unavailable. Please try again.";

function getReadableError(err) {
  if (err.message === "GROQ_API_KEY is not configured") {
    return err.message;
  }

  if (err.message === "Groq returned invalid JSON") {
    return err.message;
  }

  if (err.status === 401 || /invalid api key|unauthorized/i.test(err.message)) {
    return "Groq API key is invalid or missing";
  }

  return "Groq API request failed";
}

function extractFailureCode(err) {
  if (err.status) {
    return String(err.status);
  }

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
  const status = err.status;

  if (message === "GROQ_API_KEY is not configured") {
    return false;
  }

  if (message === "Groq returned invalid JSON") {
    return false;
  }

  if (status === 401 || /invalid api key|unauthorized/i.test(message)) {
    return false;
  }

  if (status === 503 || /\[503\]|\b503\b|Service Unavailable/i.test(message)) {
    return true;
  }

  if (status === 429 || /\[429\]|Too Many Requests|\b429\b/i.test(message)) {
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
    throw new Error("Groq returned invalid JSON");
  }
}

async function makeGroqRequest(prompt, modelName, apiKey) {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw Object.assign(new Error(`[${response.status}] ${body}`), {
      status: response.status,
    });
  }

  const data = JSON.parse(body);
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq returned an empty response");
  }

  return parseJsonResponse(text);
}

async function analyze(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const modelName = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const startTime = Date.now();

  logInfo("AI request started", { model: modelName, provider: "groq" });

  try {
    const parsed = await retryAsync(
      () => makeGroqRequest(prompt, modelName, apiKey),
      {
        maxAttempts: MAX_ATTEMPTS,
        delays: RETRY_DELAYS_MS,
        isRetryable: isRetryableError,
        onRetry: (err, attempt, delay, maxAttempts) => {
          logInfo(`Groq request failed (${extractFailureCode(err)})`);
          logInfo(`Retry ${attempt}/${maxAttempts} in ${delay} ms`);
        },
      }
    );

    logInfo("AI request completed", {
      durationMs: Date.now() - startTime,
      provider: "groq",
    });

    return parsed;
  } catch (err) {
    logError("AI request failed", {
      durationMs: Date.now() - startTime,
      message: err.message,
      provider: "groq",
    });

    if (isRetryableError(err)) {
      logInfo("Retries exhausted");
      throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
    }

    throw new Error(getReadableError(err));
  }
}

module.exports = { analyze };
