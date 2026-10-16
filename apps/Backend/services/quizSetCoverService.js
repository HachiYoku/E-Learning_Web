const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const { uploadStream } = require("./uploadStream");
const QuizSet = require("../models/quizSetModel");
const CoverAsset = require("../models/quizSetCoverAssetModel");
const { QuizSetError } = require("./standaloneQuizSets");
const { resolveCoverEnvironment } = require("./quizSetCoverEnvironment");

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const invalid = (message) => new QuizSetError(400, message, "invalid_quiz_set_cover");
const missing = () => new QuizSetError(404, "Quiz Set is unavailable.", "quiz_set_unavailable");
const stale = () => new QuizSetError(409, "The Quiz Set changed. Reload before retrying.", "stale_quiz_set");
const untracked = () => new QuizSetError(409, "The Quiz Set cover ownership could not be verified. It cannot be deleted safely.", "quiz_set_cover_unverified");

function checkedVersion(value) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) throw invalid("A valid expectedVersion is required.");
  return version;
}

async function currentSet(setId, expectedVersion) {
  if (!mongoose.isValidObjectId(setId)) throw missing();
  const set = await QuizSet.findById(setId);
  if (!set) throw missing();
  if (set.version !== expectedVersion) throw stale();
  return set;
}

function verifiedUpload(result, publicId) {
  if (result?.public_id !== publicId || typeof result.secure_url !== "string" || result.resource_type !== "image") return false;
  try {
    const url = new URL(result.secure_url);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com"
      && !url.username && !url.password && url.pathname.includes("/image/upload/")
      && result.secure_url.length <= 2048;
  } catch { return false; }
}

async function queueSetCoverDeletion(set, session, { env = process.env } = {}) {
  if (!set.coverAsset) return null; // URL-only legacy covers have no verified asset to delete.
  const identity = resolveCoverEnvironment(env);
  if (cloudinary.config().cloud_name !== identity.cloudName) throw untracked();
  const asset = await CoverAsset.findById(set.coverAsset).session(session);
  if (!asset || String(asset.quizSet) !== String(set._id) || asset.environment !== identity.mode
    || asset.publicId !== `${identity.folder}/${asset._id}` || !asset.url
    || asset.url !== set.coverImage || !["active", "available"].includes(asset.state)) throw untracked();
  const queued = await CoverAsset.findOneAndUpdate({ _id: asset._id, quizSet: set._id,
    environment: identity.mode, publicId: asset.publicId, url: asset.url,
    state: { $in: ["active", "available"] } },
  { $set: { state: "cleanup_pending", cleanupReason: "set_deleted", cleanupOutcome: "queued", cleanupError: "" } },
  { session, returnDocument: "after" });
  if (!queued) throw untracked();
  return String(asset._id);
}

async function cleanupCoverAsset(asset, { abandoned = false, now = new Date(), env = process.env } = {}) {
  const identity = resolveCoverEnvironment(env);
  if (cloudinary.config().cloud_name !== identity.cloudName) return false;
  if (!asset || !["reserved", "available", "active", "cleanup_pending"].includes(asset.state)) return false;
  // Only a server-created ownership record may authorize a provider deletion.
  if (!mongoose.isValidObjectId(asset._id) || !mongoose.isValidObjectId(asset.quizSet)
    || asset.environment !== identity.mode || asset.publicId !== `${identity.folder}/${asset._id}`) return false;
  const isAbandoned = abandoned || asset.cleanupReason === "abandoned";
  if (isAbandoned && (asset.state === "active" || !asset.abandonAfter || asset.abandonAfter > now)) return false;
  const claim = await CoverAsset.findOneAndUpdate({ _id: asset._id, quizSet: asset.quizSet, environment: identity.mode,
    publicId: asset.publicId, state: asset.state,
    ...(isAbandoned ? { abandonAfter: { $lte: now } } : {}) },
  { $set: { state: "cleanup_processing", cleanupStartedAt: now, cleanupOutcome: "processing",
    cleanupReason: isAbandoned ? "abandoned" : (asset.cleanupReason || "replaced") }, $inc: { cleanupAttempts: 1 } },
  { returnDocument: "after" });
  if (!claim) return false; // Another cleanup process won the claim.
  if (claim.environment !== identity.mode || claim.publicId !== asset.publicId || String(claim.quizSet) !== String(asset.quizSet)) {
    // The claim is unexpectedly inconsistent. Keep it for supervised recovery; never call Cloudinary.
    return false;
  }
  const claimFilter = { _id: asset._id, state: "cleanup_processing", cleanupStartedAt: now };
  // A legacy URL-only Set could also refer to this URL. Recheck *after* the
  // claim; never delete on an Admin-provided ID or a stale ownership snapshot.
  let referenced;
  try {
    referenced = await QuizSet.exists({ $or: [{ coverAsset: asset._id },
      ...(claim.url ? [{ coverImage: claim.url }] : [])] });
  } catch (error) {
    await CoverAsset.updateOne(claimFilter, { $set: { state: "cleanup_pending",
      cleanupError: error?.name || "reference_check_failed", cleanupFinishedAt: new Date(), cleanupOutcome: "failed" } });
    return false;
  }
  if (referenced) {
    await CoverAsset.updateOne(claimFilter, { $set: { state: asset.state,
      cleanupFinishedAt: new Date(), cleanupOutcome: "referenced" } });
    return false;
  }
  try {
    const result = await cloudinary.uploader.destroy(asset.publicId, { resource_type: "image", type: "upload", invalidate: true });
    if (!["ok", "not found"].includes(result?.result)) throw new Error("provider_delete_unconfirmed");
    await CoverAsset.updateOne(claimFilter, { $set: { state: "deleted", cleanupError: "",
      cleanupFinishedAt: new Date(), cleanupOutcome: result.result } });
    return true;
  } catch (error) {
    await CoverAsset.updateOne(claimFilter, { $set: { state: "cleanup_pending",
      cleanupError: error?.name || "cleanup_failed", cleanupFinishedAt: new Date(), cleanupOutcome: "failed" } });
    return false;
  }
}

async function retryCoverCleanup({ execute = false, limit = 20, now = new Date(), env = process.env } = {}) {
  const identity = resolveCoverEnvironment(env);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid("Cleanup limit must be between 1 and 100.");
  // Filter references before applying the limit. Healthy active covers never enter
  // this queue, and a referenced pending cover cannot starve other work.
  const candidates = await CoverAsset.aggregate([
    { $match: { environment: identity.mode, $or: [
      { state: "cleanup_pending", cleanupReason: { $ne: "abandoned" } },
      { state: "cleanup_pending", cleanupReason: "abandoned", abandonAfter: { $lte: now } },
      { state: { $in: ["reserved", "available"] }, abandonAfter: { $lte: now } },
    ] } },
    { $addFields: { cleanupPriority: { $cond: [{ $eq: ["$state", "cleanup_pending"] }, 0, 1] } } },
    { $sort: { cleanupPriority: 1, _id: 1 } },
    { $lookup: { from: "quizsets", let: { assetId: "$_id", assetUrl: "$url" }, pipeline: [
      { $match: { $expr: { $or: [
        { $eq: ["$coverAsset", "$$assetId"] },
        { $and: [{ $ne: ["$$assetUrl", ""] }, { $eq: ["$coverImage", "$$assetUrl"] }] },
      ] } } }, { $limit: 1 }, { $project: { _id: 1 } },
    ], as: "references" } },
    { $match: { references: { $size: 0 } } },
    { $limit: limit },
    { $project: { references: 0, cleanupPriority: 0 } },
  ]);
  const summary = { mode: execute ? "execute" : "dry-run", candidates: candidates.length,
    attempted: 0, deleted: 0, skipped: 0, failed: 0 };
  if (!execute) return summary; // No database or Cloudinary mutation in dry-run.
  for (const asset of candidates) {
    const abandoned = ["reserved", "available"].includes(asset.state) || asset.cleanupReason === "abandoned";
    const attemptsBefore = asset.cleanupAttempts || 0;
    const cleaned = await cleanupCoverAsset(asset, { abandoned, now, env });
    // A refused claim/reference is a skip. A claimed provider failure is a failure.
    const latest = await CoverAsset.findById(asset._id).select("cleanupAttempts cleanupOutcome").lean();
    if ((latest?.cleanupAttempts || 0) <= attemptsBefore) { summary.skipped += 1; continue; }
    summary.attempted += 1;
    if (cleaned) summary.deleted += 1;
    else if (latest?.cleanupOutcome === "failed") summary.failed += 1;
    else summary.skipped += 1;
  }
  return summary;
}

async function cleanupPrevious(previousAssetId, setId, env) {
  if (!previousAssetId) return "complete"; // Legacy URL-only covers are never deleted.
  const identity = resolveCoverEnvironment(env);
  try {
    const asset = await CoverAsset.findOne({ _id: previousAssetId, quizSet: setId, environment: identity.mode });
    if (!asset) return "retry_required";
    return await cleanupCoverAsset(asset, { env }) ? "complete" : "retry_required";
  } catch (_error) {
    // The Set update already succeeded. Make an orphaned former cover visible
    // to the operator retry command when the database permits this write.
    await CoverAsset.updateOne({ _id: previousAssetId, quizSet: setId, environment: identity.mode,
      state: { $in: ["active", "available"] } },
      { $set: { state: "cleanup_pending", cleanupReason: "replaced", cleanupOutcome: "failed",
        cleanupError: "cleanup_interrupted", cleanupFinishedAt: new Date() } }).catch(() => undefined);
    return "retry_required";
  }
}

async function uploadCover(setId, rawVersion, file, { env = process.env } = {}) {
  const identity = resolveCoverEnvironment(env);
  const expectedVersion = checkedVersion(rawVersion);
  if (!file?.buffer) throw invalid("Select a JPG, PNG, or WebP cover image.");
  const set = await currentSet(setId, expectedVersion);
  const assetId = new mongoose.Types.ObjectId();
  const publicId = `${identity.folder}/${assetId}`;
  const asset = await CoverAsset.create({ _id: assetId, quizSet: set._id, environment: identity.mode, publicId,
    abandonAfter: new Date(Date.now() + SEVEN_DAYS) });
  let uploaded;
  try {
    uploaded = await uploadStream(file.buffer, identity.folder, {
      public_id: String(assetId), overwrite: false, resource_type: "image",
    });
  } catch (_error) {
    // The reservation is retained: an ambiguous provider failure may still
    // have created bytes. A later, separately authorized cleanup can inspect it.
    throw new QuizSetError(503, "Cover upload could not be confirmed. Check the Quiz Set before trying again.", "cover_upload_uncertain");
  }
  if (!verifiedUpload(uploaded, publicId)) {
    throw new QuizSetError(503, "Cover upload could not be verified. Check the Quiz Set before trying again.", "cover_upload_uncertain");
  }
  const registered = await CoverAsset.updateOne({ _id: assetId, quizSet: set._id, environment: identity.mode, state: "reserved" },
    { $set: { url: uploaded.secure_url, state: "available" } });
  if (registered.matchedCount !== 1) {
    throw new QuizSetError(503, "Cover upload could not be verified. Check the Quiz Set before trying again.", "cover_upload_uncertain");
  }
  const updated = await QuizSet.findOneAndUpdate({ _id: set._id, version: expectedVersion },
    { $set: { coverImage: uploaded.secure_url, coverAsset: assetId }, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true });
  if (!updated) throw stale(); // The unreferenced asset remains eligible after seven days.
  await CoverAsset.updateOne({ _id: assetId, environment: identity.mode }, { $set: { state: "active" } }).catch(() => undefined);
  return { set: updated, cleanup: await cleanupPrevious(set.coverAsset, set._id, env) };
}

async function removeCover(setId, rawVersion, { env = process.env } = {}) {
  resolveCoverEnvironment(env);
  const expectedVersion = checkedVersion(rawVersion);
  const set = await currentSet(setId, expectedVersion);
  if (!set.coverImage && !set.coverAsset) return { set, cleanup: "complete" };
  const updated = await QuizSet.findOneAndUpdate({ _id: set._id, version: expectedVersion },
    { $set: { coverImage: "", coverAsset: null }, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true });
  if (!updated) throw stale();
  return { set: updated, cleanup: await cleanupPrevious(set.coverAsset, set._id, env) };
}

module.exports = { uploadCover, removeCover, cleanupCoverAsset, retryCoverCleanup, queueSetCoverDeletion,
  checkedVersion, verifiedUpload };
