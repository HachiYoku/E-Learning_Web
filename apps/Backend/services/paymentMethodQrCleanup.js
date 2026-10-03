const crypto = require("crypto");
const cloudinary = require("../config/cloudinary");
const PaymentMethod = require("../models/paymentMethodModel");
const Cleanup = require("../models/paymentMethodQrCleanupModel");

const PREFIX = "arun_thai/payment_method_qr_codes/";
const owned = (id) => typeof id === "string" && id.startsWith(PREFIX);
const retryAt = (attempts) => new Date(Date.now() + Math.min(86400000, 60000 * (2 ** Math.min(attempts, 10))));

async function queue(publicId) {
  if (!owned(publicId)) return false;
  await Cleanup.updateOne({ publicId }, { $setOnInsert: { publicId, state: "pending" } }, { upsert: true });
  return true;
}

async function claimNext(now) {
  const token = crypto.randomUUID();
  return Cleanup.findOneAndUpdate(
    { $or: [
      { state: "pending" },
      { state: "failed", nextAttemptAt: { $lte: now } },
    ] },
    { $set: { state: "processing", claim: { token, claimedAt: now } } },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  ).select("+claim");
}

async function processClaimed(job) {
  const query = { _id: job._id, state: "processing", "claim.token": job.claim.token };
  // A snapshot is non-owning historical data; only the current method can
  // protect an asset from deletion. Revalidate it immediately before delete.
  if (!owned(job.publicId) || await PaymentMethod.exists({ "qrImage.publicId": job.publicId })) {
    await Cleanup.deleteOne(query);
    return { preserved: true };
  }
  try {
    const result = await cloudinary.uploader.destroy(job.publicId, { resource_type: "image", type: "upload", invalidate: true });
    if (!["ok", "not found", "not_found"].includes(result?.result)) throw new Error(`Cloudinary QR deletion failed: ${result?.result || "unexpected response"}`);
    await Cleanup.deleteOne(query);
    return { cleaned: true };
  } catch (error) {
    const attempts = Number(job.attempts || 0) + 1;
    await Cleanup.updateOne(query, { $set: { state: "failed", attempts, lastError: String(error.message).slice(0, 500), nextAttemptAt: retryAt(attempts) }, $unset: { claim: 1 } });
    return { retryable: true };
  }
}

async function processPaymentMethodQrCleanup({ limit = 50, now = new Date() } = {}) {
  const results = [];
  for (let index = 0; index < limit; index += 1) {
    const job = await claimNext(now);
    if (!job) break;
    results.push(await processClaimed(job));
  }
  return results;
}

async function recoverStalePaymentMethodQrClaims({ writersStopped = false } = {}) {
  if (!writersStopped) throw new Error("QR cleanup claim recovery requires writersStopped: true after all backend writers are stopped.");
  let recovered = 0;
  for await (const job of Cleanup.find({ state: "processing" }).select("+claim")) {
    if (!owned(job.publicId) || await PaymentMethod.exists({ "qrImage.publicId": job.publicId })) {
      await Cleanup.deleteOne({ _id: job._id, state: "processing", "claim.token": job.claim?.token });
    } else {
      const result = await Cleanup.updateOne({ _id: job._id, state: "processing", "claim.token": job.claim?.token }, { $set: { state: "pending" }, $unset: { claim: 1 } });
      recovered += result.modifiedCount;
    }
  }
  return recovered;
}

module.exports = { PREFIX, owned, queue, processPaymentMethodQrCleanup, processClaimed, recoverStalePaymentMethodQrClaims };
