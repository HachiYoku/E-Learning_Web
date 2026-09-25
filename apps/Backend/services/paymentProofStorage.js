const cloudinary = require("../config/cloudinary");
const { uploadStream } = require("./uploadStream");

const PAYMENT_PROOF_FOLDER = "arun_thai/payment_proofs";
const PRIVATE_PROOF_DOWNLOAD_TTL_SECONDS = 60;

async function uploadPaymentProof(buffer, publicId) {
  return uploadStream(buffer, PAYMENT_PROOF_FOLDER, {
    resource_type: "image",
    type: "authenticated",
    ...(publicId ? { folder: "", public_id: publicId, overwrite: false } : {}),
  });
}

function assertLegacyCloudinaryUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Legacy payment proof URL is invalid");
  }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.includes("/image/upload/")) {
    throw new Error("Legacy payment proof is not a supported Cloudinary image");
  }
  return url;
}

async function migrateLegacyPaymentProof(legacyUrl) {
  const source = assertLegacyCloudinaryUrl(legacyUrl);
  const response = await fetch(source, { redirect: "error" });
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (!response.ok || (contentLength && contentLength > 5 * 1024 * 1024)) throw new Error("Legacy payment proof is unavailable");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error("Legacy payment proof is too large");
  return uploadPaymentProof(buffer);
}

function privateProofDownloadUrl(publicId, format) {
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: "image",
    type: "authenticated",
    attachment: false,
    expires_at: Math.floor(Date.now() / 1000) + PRIVATE_PROOF_DOWNLOAD_TTL_SECONDS,
  });
}

async function streamPaymentProof(publicId, format) {
  const response = await fetch(privateProofDownloadUrl(publicId, format));
  if (!response.ok || !response.body) throw new Error("Payment proof is unavailable");
  return response;
}

async function deletePaymentProof(publicId, { legacy = false } = {}) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: legacy ? "upload" : "authenticated",
    invalidate: true,
  });
}

module.exports = {
  PRIVATE_PROOF_DOWNLOAD_TTL_SECONDS,
  uploadPaymentProof,
  migrateLegacyPaymentProof,
  streamPaymentProof,
  deletePaymentProof,
};
