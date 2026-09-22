const multer = require("multer");
const { logUnexpectedError } = require("./monitoring");

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Uploaded file must be 5 MB or smaller." });
    }

    return res.status(400).json({ message: "File upload could not be processed." });
  }

  // Deliberately preserve expected, application-defined client errors only.
  if (Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 500) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logUnexpectedError(req, error);
  return res.status(500).json({
    message: "Internal server error",
    requestId: req.requestId,
  });
}

module.exports = errorHandler;
