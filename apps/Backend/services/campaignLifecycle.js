const Campaign = require("../models/campaignModel");
const Cleanup = require("../models/campaignAssetCleanupModel");
const cloudinary = require("../config/cloudinary");

const CAMPAIGN_ASSET_PREFIX = "english_kafe/campaigns/";

function addCalendarMonths(date, months) {
  const result = new Date(date); const day = result.getDate(); result.setDate(1); result.setMonth(result.getMonth() + months);
  result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate())); return result;
}

const campaignExpiry = (date = new Date()) => addCalendarMonths(date, 12);
const isOwnedCampaignAsset = (publicId) => typeof publicId === "string" && publicId.startsWith(CAMPAIGN_ASSET_PREFIX);
const retryAt = (attempts) => new Date(Date.now() + Math.min(86400000, 60000 * (2 ** Math.min(attempts, 10))));

async function queueCampaignAssetCleanup(campaignId, publicId, { removeCampaign = false } = {}) {
  if (!isOwnedCampaignAsset(publicId)) return { queued: false, reason: "not_owned" };
  await Cleanup.updateOne({ publicId }, { $setOnInsert: { campaignId, publicId, removeCampaign, state: "pending", attempts: 0 } }, { upsert: true });
  return { queued: true };
}

async function processCampaignAssetCleanup(job) {
  const references = await Campaign.countDocuments({ imagePublicId: job.publicId, _id: { $ne: job.campaignId } });
  if (!isOwnedCampaignAsset(job.publicId) || references) {
    if (job.removeCampaign) await Campaign.deleteOne({ _id: job.campaignId, cleanupState: "claimed" });
    await job.deleteOne();
    return { cleaned: false, preserved: true };
  }
  try {
    await cloudinary.uploader.destroy(job.publicId, { resource_type: "image", type: "upload", invalidate: true });
    if (job.removeCampaign) await Campaign.deleteOne({ _id: job.campaignId, cleanupState: "claimed" });
    await job.deleteOne();
    return { cleaned: true };
  } catch (error) {
    job.state = "failed"; job.attempts += 1; job.lastError = String(error?.message || "Campaign asset cleanup failed").slice(0, 500); job.nextAttemptAt = retryAt(job.attempts);
    await job.save(); return { cleaned: false, retryable: true };
  }
}

async function processExpiredCampaigns({ limit = 50, now = new Date() } = {}) {
  const results = [];
  for (let count = 0; count < limit; count += 1) {
    const campaign = await Campaign.findOneAndUpdate({ expiresAt: { $lte: now }, cleanupState: "active" }, { $set: { cleanupState: "claimed" } }, { new: true });
    if (!campaign) break;
    if (!campaign.imagePublicId) { await campaign.deleteOne(); results.push({ deleted: true, image: false }); continue; }
    await queueCampaignAssetCleanup(campaign._id, campaign.imagePublicId, { removeCampaign: true });
    const job = await Cleanup.findOne({ publicId: campaign.imagePublicId });
    results.push(await processCampaignAssetCleanup(job));
  }
  for await (const job of Cleanup.find({ $or: [{ state: "pending" }, { state: "failed", nextAttemptAt: { $lte: now } }] }).limit(limit)) results.push(await processCampaignAssetCleanup(job));
  return results;
}

async function recoverStaleCampaignClaims({ writersStopped = false, now = new Date() } = {}) {
  if (!writersStopped) throw new Error("Campaign claim recovery requires writersStopped: true after all backend writers are stopped.");
  let recovered = 0;
  for await (const campaign of Campaign.find({ cleanupState: "claimed", expiresAt: { $lte: now } })) {
    if (!campaign.imagePublicId) {
      const result = await Campaign.deleteOne({ _id: campaign._id, cleanupState: "claimed", expiresAt: { $lte: now } }); recovered += result.deletedCount; continue;
    }
    const existingJob = await Cleanup.exists({ publicId: campaign.imagePublicId });
    if (!existingJob) {
      const queued = await queueCampaignAssetCleanup(campaign._id, campaign.imagePublicId, { removeCampaign: true });
      recovered += Number(queued.queued);
    }
  }
  return recovered;
}

module.exports = { CAMPAIGN_ASSET_PREFIX, campaignExpiry, isOwnedCampaignAsset, processExpiredCampaigns, queueCampaignAssetCleanup, recoverStaleCampaignClaims };
