const INJECTION_PATTERNS = [
  { pattern: /ignore previous instructions/i, reason: "Ignore previous instructions" },
  { pattern: /forget previous instructions/i, reason: "Forget previous instructions" },
  { pattern: /you are chatgpt/i, reason: "You are ChatGPT" },
  { pattern: /you are gemini/i, reason: "You are Gemini" },
  { pattern: /system prompt/i, reason: "System prompt" },
  { pattern: /developer prompt/i, reason: "Developer prompt" },
  { pattern: /reveal your instructions/i, reason: "Reveal your instructions" },
  { pattern: /print your prompt/i, reason: "Print your prompt" },
  { pattern: /execute code/i, reason: "Execute code" },
  { pattern: /run shell/i, reason: "Run shell" },
  { pattern: /\bsudo\b/i, reason: "sudo" },
  { pattern: /rm\s+-rf/i, reason: "rm -rf" },
  { pattern: /begin system prompt/i, reason: "BEGIN SYSTEM PROMPT" },
  { pattern: /end system prompt/i, reason: "END SYSTEM PROMPT" },
];

function inspectPrompt(message) {
  const sanitizedMessage = typeof message === "string" ? message.trim() : "";

  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: true,
        reason,
        sanitizedMessage,
      };
    }
  }

  return {
    blocked: false,
    reason: null,
    sanitizedMessage,
  };
}

module.exports = { inspectPrompt };
