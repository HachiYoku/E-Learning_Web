const cloudinary = require("../config/cloudinary");
const AccountAssetCleanup = require("../models/accountAssetCleanupModel");

const retryDelayMs = (attempts) => Math.min(24 * 60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(attempts, 10)));

async function cleanAccountAsset(cleanupId) {
  const cleanup = await AccountAssetCleanup.findById(cleanupId);
  if (!cleanup) return { cleaned: true };

  try {
    await cloudinary.uploader.destroy(cleanup.publicId, {
      resource_type: cleanup.resourceType,
      type: cleanup.deliveryType,
      invalidate: true,
    });
    await cleanup.deleteOne();
    return { cleaned: true };
  } catch (error) {
    const attempts = cleanup.attempts + 1;
    cleanup.state = "failed";
    cleanup.attempts = attempts;
    cleanup.lastError = String(error?.message || "Asset cleanup failed").slice(0, 500);
    cleanup.nextAttemptAt = new Date(Date.now() + retryDelayMs(attempts));
    await cleanup.save();
    return { cleaned: false, error: cleanup.lastError };
  }
}

async function retryPendingAccountAssets({ limit = 50 } = {}) {
  const pending = await AccountAssetCleanup.find({
    $or: [{ state: "pending" }, { state: "failed", nextAttemptAt: { $lte: new Date() } }],
  }).sort({ createdAt: 1 }).limit(limit);
  return Promise.all(pending.map((cleanup) => cleanAccountAsset(cleanup._id)));
}

module.exports = { cleanAccountAsset, retryPendingAccountAssets };
