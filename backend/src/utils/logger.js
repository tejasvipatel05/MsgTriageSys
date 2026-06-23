function formatMeta(meta) {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(meta)}`;
}

function logInfo(message, meta) {
  console.log(`[INFO] ${message}${formatMeta(meta)}`);
}

function logError(message, meta) {
  console.error(`[ERROR] ${message}${formatMeta(meta)}`);
}

module.exports = { logInfo, logError };
