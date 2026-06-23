function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message,
  });
}

module.exports = { sendError };
