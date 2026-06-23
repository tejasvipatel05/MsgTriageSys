const { logInfo } = require("./logger");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryAsync(fn, options = {}) {
  const {
    maxAttempts = 3,
    delays = [500, 1000],
    isRetryable = () => false,
    onRetry = () => {},
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (attempt > 1) {
        logInfo("Retry successful");
      }

      return result;
    } catch (err) {
      lastError = err;

      const canRetry = attempt < maxAttempts && isRetryable(err);
      if (!canRetry) {
        throw err;
      }

      const delay = delays[attempt - 1] ?? delays[delays.length - 1];
      onRetry(err, attempt, delay, maxAttempts);
      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = { retryAsync };
