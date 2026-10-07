const multer = require("multer");

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_QUIZ_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
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

function quizMediaFileFilter(_req, file, callback) {
  const isImage = /^questionImage_\d+$/.test(file.fieldname);
  const isAudio = /^questionAudio_\d+$/.test(file.fieldname);
  const imageOk = isImage && new Set(["image/jpeg", "image/png", "image/webp"]).has(file.mimetype);
  const audioOk = isAudio && new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a"]).has(file.mimetype);
  if (!imageOk && !audioOk) {
    const error = new Error("Quiz media must be JPG, PNG, WebP, MP3, or M4A.");
    error.statusCode = 400;
    return callback(error);
  }
  if (isImage && file.size > MAX_UPLOAD_SIZE_BYTES || isAudio && file.size > MAX_QUIZ_AUDIO_SIZE_BYTES) {
    const error = new Error("Quiz media file is too large.");
    error.statusCode = 400;
    return callback(error);
  }
  return callback(null, true);
}

function createQuizMediaUpload({ maxFiles = 20 } = {}) {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_QUIZ_AUDIO_SIZE_BYTES, files: maxFiles }, fileFilter: quizMediaFileFilter });
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

function hasExpectedAudioSignature(file) {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  if (file.mimetype === "audio/mpeg") return buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (["audio/mp4", "audio/x-m4a"].includes(file.mimetype)) return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  return false;
}

function validateQuizMediaContent(req, res, next) {
  const files = Array.isArray(req.files) ? req.files : [];
  const valid = files.every((file) => /^questionImage_\d+$/.test(file.fieldname)
    ? file.buffer.length <= MAX_UPLOAD_SIZE_BYTES && hasExpectedImageSignature(file)
    : /^questionAudio_\d+$/.test(file.fieldname) && file.buffer.length <= MAX_QUIZ_AUDIO_SIZE_BYTES && hasExpectedAudioSignature(file));
  if (!valid) return res.status(400).json({ message: "Uploaded Quiz media contents do not match a supported format." });
  return next();
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  createImageUpload,
  validateImageFileContent,
  MAX_QUIZ_AUDIO_SIZE_BYTES,
  createQuizMediaUpload,
  validateQuizMediaContent,
};
