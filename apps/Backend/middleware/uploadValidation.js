const multer = require("multer");

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function imageFileFilter(_req, file, callback) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    const error = new Error(
      `${file.fieldname} must be a JPG, PNG, WEBP, or GIF image.`
    );
    error.statusCode = 400;
    return callback(error);
  }

  return callback(null, true);
}

function createImageUpload({ maxFiles } = {}) {
  const limits = { fileSize: MAX_UPLOAD_SIZE_BYTES };
  if (maxFiles) {
    limits.files = maxFiles;
  }

  return multer({
    storage: multer.memoryStorage(),
    limits,
    fileFilter: imageFileFilter,
  });
}

function hasExpectedImageSignature(file) {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer)) return false;

  if (file.mimetype === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (file.mimetype === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === "image/gif") return buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
  if (file.mimetype === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function validateImageFileContent(req, res, next) {
  const uploadedFiles = Array.isArray(req.files)
    ? req.files
    : Object.values(req.files || {}).flat();
  const files = [req.file, ...uploadedFiles].filter(Boolean);
  if (files.some((file) => !hasExpectedImageSignature(file))) {
    return res.status(400).json({ message: "Uploaded file contents do not match a supported image format." });
  }
  return next();
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  createImageUpload,
  validateImageFileContent,
};
