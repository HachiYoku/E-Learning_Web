const mongoose = require("mongoose");
const { createHash } = require("node:crypto");
const QuizSet = require("../models/quizSetModel");
const Quiz = require("../models/quizModel");
const QuizCreationRequest = require("../models/quizCreationRequestModel");
const QuizMedia = require("../models/quizMediaModel");
const { uploadStream } = require("./uploadStream");
const { cleanupQuizMedia } = require("./quizMediaLifecycle");
const { draftFields, validateDraft } = require("./standaloneQuizRevisions");
const { runStandaloneTransaction, StandaloneTransactionConflict,
  StandaloneTransactionOutcomeUnknown } = require("./standaloneQuizTransactions");
const { requireCreationIndex, QuizCreationUnavailable } = require("./standaloneQuizCreationReadiness");

class QuizSetError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class QuizCreationOutcomeUnknown extends Error {
  constructor() {
    super("Quiz creation may have completed. Check the Quiz Set before retrying.");
    this.status = 503;
    this.code = "quiz_creation_outcome_unknown";
  }
}

const missing = () => new QuizSetError(404, "Quiz Set is unavailable.", "quiz_set_unavailable");
const stale = () => new QuizSetError(409, "The Quiz Set changed. Reload before retrying.", "stale_quiz_set");
const invalid = (message) => new QuizSetError(400, message, "invalid_quiz_set");
const conflict = (message, code = "quiz_set_conflict") => new QuizSetError(409, message, code);
const validId = (id) => mongoose.isValidObjectId(id);
const validVersion = (n) => Number.isSafeInteger(n) && n >= 1;

function metadata(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("Invalid Quiz Set metadata.");
  const allowed = new Set(["name", "description", "coverImage", "difficulty", "displayOrder"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw invalid("Unsupported Quiz Set field.");
  const fields = {};
  if (Object.hasOwn(input, "name")) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 140) throw invalid("Name is required (maximum 140 characters).");
    fields.name = input.name.trim();
  }
  for (const [key, max] of [["description", 1000], ["coverImage", 2048]]) {
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "string" || input[key].trim().length > max) throw invalid(`Invalid ${key}.`);
      fields[key] = input[key].trim();
    }
  }
  if (fields.coverImage) {
    try {
      const url = new URL(fields.coverImage);
      if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password
        || !url.pathname.includes("/image/upload/")) throw new Error();
    } catch (_error) { throw invalid("Cover image must be a Cloudinary HTTPS image URL."); }
  }
  if (Object.hasOwn(input, "difficulty")) {
    if (input.difficulty !== null && !QuizSet.QUIZ_SET_DIFFICULTIES.includes(input.difficulty)) throw invalid("Invalid difficulty.");
    fields.difficulty = input.difficulty;
  }
  if (Object.hasOwn(input, "displayOrder")) {
    if (!Number.isSafeInteger(input.displayOrder) || input.displayOrder < 1) throw invalid("Display order must be a positive integer.");
    fields.displayOrder = input.displayOrder;
  }
  return fields;
}

async function writeSetFence(set, session, { status, incrementEpoch = false, update = {}, expectedVersion } = {}) {
  const match = { _id: set._id, status: set.status, runtimeEpoch: set.runtimeEpoch,
    runtimeFence: set.runtimeFence, version: expectedVersion ?? set.version };
  const changes = { $inc: { runtimeFence: 1, ...(incrementEpoch ? { runtimeEpoch: 1 } : {}),
    ...(expectedVersion === undefined ? {} : { version: 1 }) },
  };
  if (status !== undefined || Object.keys(update).length) changes.$set = { ...update, ...(status === undefined ? {} : { status }) };
  return QuizSet.findOneAndUpdate(match, changes, { session, returnDocument: "after", runValidators: true });
}

async function fenceActiveSetForQuiz(quiz, session) {
  if (!quiz.quizSet) return null; // Legacy standalone records are not silently migrated.
  const set = await QuizSet.findById(quiz.quizSet).session(session);
  if (!set || set.status !== "active") throw missing();
  const fenced = await writeSetFence(set, session);
  if (!fenced) throw new StandaloneTransactionConflict();
  return fenced;
}

async function createSet(input) {
  const fields = metadata(input);
  if (!fields.name) throw invalid("Name is required.");
  if (fields.coverImage) throw invalid("Upload a cover after creating the Quiz Set.");
  return QuizSet.create({ ...fields, status: "disabled" });
}

async function updateSet(setId, expectedVersion, input) {
  if (!validId(setId)) throw missing();
  if (!validVersion(expectedVersion)) throw invalid("expectedVersion is required.");
  const fields = metadata(input);
  if (!Object.keys(fields).length) throw invalid("No changes were supplied.");
  if (Object.hasOwn(fields, "coverImage")) {
    const current = await QuizSet.findById(setId).select("coverImage").lean();
    if (!current) throw missing();
    if (fields.coverImage !== (current.coverImage || "")) throw invalid("Use the cover upload or removal control to change this image.");
    delete fields.coverImage;
  }
  const updated = await QuizSet.findOneAndUpdate({ _id: setId, version: expectedVersion },
    { $set: fields, $inc: { version: 1 } }, { returnDocument: "after", runValidators: true });
  if (!updated) throw (await QuizSet.exists({ _id: setId })) ? stale() : missing();
  return updated;
}

const transitions = {
  activate: { from: "disabled", to: "active" },
  disable: { from: "active", to: "disabled", revoke: true },
  archive: { from: ["active", "disabled"], to: "archived", revoke: true },
  restore: { from: "archived", to: "disabled" },
};

async function transitionSet(setId, expectedVersion, action) {
  if (!validId(setId)) throw missing();
  if (!validVersion(expectedVersion)) throw invalid("expectedVersion is required.");
  const rule = transitions[action];
  if (!rule) throw invalid("Unknown lifecycle action.");
  return runStandaloneTransaction(async (session) => {
    const set = await QuizSet.findById(setId).session(session);
    if (!set) throw missing();
    if (set.version !== expectedVersion) throw stale();
    if (!(Array.isArray(rule.from) ? rule.from : [rule.from]).includes(set.status)) {
      throw conflict("This lifecycle transition is not allowed.", "invalid_quiz_set_transition");
    }
    const updated = await writeSetFence(set, session, { status: rule.to, incrementEpoch: !!rule.revoke, expectedVersion });
    if (!updated) throw new StandaloneTransactionConflict();
    return updated;
  }, { resolveAmbiguous: async (result) => result && QuizSet.findOne({ _id: result._id,
    version: result.version, status: result.status, runtimeEpoch: result.runtimeEpoch }) || undefined });
}

async function orderQuiz(setId, quizId, expectedVersion, sortOrder) {
  if (!validId(setId) || !validId(quizId)) throw missing();
  if (!validVersion(expectedVersion) || !Number.isSafeInteger(sortOrder) || sortOrder < 1) throw invalid("Valid expectedVersion and sortOrder are required.");
  return runStandaloneTransaction(async (session) => {
    const set = await QuizSet.findById(setId).session(session);
    if (!set || set.status === "archived") throw missing();
    if (set.version !== expectedVersion) throw stale();
    const fencedSet = await writeSetFence(set, session, { expectedVersion });
    if (!fencedSet) throw new StandaloneTransactionConflict();
    const quiz = await Quiz.findOne({ _id: quizId, quizSet: setId, contextType: "standalone" }).session(session);
    if (!quiz) throw missing();
    const updated = await Quiz.findOneAndUpdate({ _id: quizId, quizSet: setId, contextType: "standalone",
      runtimeFence: quiz.runtimeFence === undefined ? { $exists: false } : quiz.runtimeFence },
    { $set: { sortOrder }, $inc: { runtimeFence: 1 } }, { session, returnDocument: "after", runValidators: true });
    if (!updated) throw new StandaloneTransactionConflict();
    return { quiz: updated, setVersion: fencedSet.version };
  });
}

function checkedDraftFields(input) {
  const fields = draftFields(input);
  if (!Array.isArray(fields.questions) || fields.questions.length < 1 || fields.questions.length > 10) {
    throw new QuizSetError(400, "Add between 1 and 10 questions.", "invalid_quiz_draft");
  }
  // Phase 1 supports text-only Set drafts; the later media phase owns uploads.
  if (fields.questions.some((q) => q?.image || q?.audio || q?.imagePublicId || q?.audioPublicId)) throw invalid("Set draft media is not available yet.");
  return fields;
}

async function createSetDraftInSession(setId, fields, session, allocatedId) {
  const set = await QuizSet.findById(setId).session(session);
  if (!set || set.status === "archived") throw missing();
  if (!await writeSetFence(set, session)) throw new StandaloneTransactionConflict();
  const last = await Quiz.findOne({ quizSet: setId, contextType: "standalone" }).sort({ sortOrder: -1, _id: -1 }).session(session);
  const quizId = allocatedId || new mongoose.Types.ObjectId();
  const shell = { _id: quizId, title: String(fields.title || ""), status: "draft", publishedRevision: null, revision: 1 };
  const normalized = await validateDraft(shell, { ...fields, version: 1, basePublishedRevision: null });
  const [quiz] = await Quiz.create([{ ...shell, contextType: "standalone", quizSet: set._id,
    sortOrder: (last?.sortOrder || 0) + 1, questions: [], draft: normalized }], { session });
  return quiz;
}

async function createSetDraft(setId, input) {
  if (!validId(setId)) throw missing();
  const fields = checkedDraftFields(input);
  return runStandaloneTransaction(async (session) => createSetDraftInSession(setId, fields, session), {
    resolveAmbiguous: async (result) => result && await Quiz.findOne({ _id: result._id,
      quizSet: setId, contextType: "standalone", status: "draft" }) || undefined });
}

// RFC 4122 version-4 UUID in its canonical lowercase representation.
const validCreationRequestId = (value) => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function creationPayloadHash(input) {
  // Valid drafts retain the original hash format. An omitted draft has no JSON
  // serialization, but still needs a stable value for a conflicting replay.
  let serialized;
  let unhashable = false;
  try { serialized = JSON.stringify(canonical(input)); }
  catch (_error) {
    // A pathological JSON shape or an invalid direct service value cannot
    // turn a committed key into a 500 or proceed to a new creation.
    serialized = "\u0000unhashable-draft";
    unhashable = true;
  }
  return { hash: createHash("sha256").update(serialized === undefined ? "undefined" : serialized).digest("hex"),
    unhashable };
}

async function readCommittedCreation(key) {
  try {
    return await mongoose.connection.db.collection("quizcreationrequests").findOne(key,
      { readConcern: { level: "majority" }, readPreference: "primary" });
  } catch (_error) {
    throw new QuizCreationUnavailable();
  }
}

async function replayCreation(record, payloadHash, session) {
  if (!record) return undefined;
  if (record.payloadHash !== payloadHash) {
    throw new QuizSetError(409, "This creation request ID was used with different quiz content.", "quiz_creation_request_reused");
  }
  if (record.status === "abandoned") {
    throw new QuizSetError(409, "This creation request was abandoned.", "quiz_creation_request_abandoned");
  }
  if (record.status === "failed") return undefined;
  if (!record.responseSnapshot || String(record.responseSnapshot.id) !== String(record.quizId)
    || String(record.responseSnapshot.quizSetId) !== String(record.quizSetId)) {
    throw new QuizCreationOutcomeUnknown();
  }
  // An inconsistent pre-existing ledger must never produce a successful replay.
  // Normal deletion paths preserve this Quiz; the read also fails closed if an
  // out-of-band change has removed it.
  try {
    const query = Quiz.exists({ _id: record.quizId, quizSet: record.quizSetId,
      contextType: "standalone" });
    const existing = session ? await query.session(session)
      : await query.readConcern("majority").read("primary");
    if (!existing) throw new QuizCreationOutcomeUnknown();
  } catch (_error) { throw new QuizCreationOutcomeUnknown(); }
  return record.responseSnapshot;
}

async function recordFailedMediaCreation(key, payloadHash, mediaCleanup) {
  let record = await readCommittedCreation(key);
  if (!record) {
    try {
      await QuizCreationRequest.create([{ ...key, payloadHash, status: "failed", mediaCleanup }],
        { writeConcern: { w: "majority" } });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    record = await readCommittedCreation(key);
  }
  if (!record) throw new QuizCreationOutcomeUnknown();
  const replayed = await replayCreation(record, payloadHash);
  if (replayed) return { replayed };
  const levels = { complete: 0, unverified: 1, retry_required: 2 };
  const combined = levels[mediaCleanup] > (levels[record.mediaCleanup] ?? -1) ? mediaCleanup : record.mediaCleanup;
  if (combined !== record.mediaCleanup) {
    await QuizCreationRequest.updateOne({ ...key, status: "failed" }, { $set: { mediaCleanup: combined } },
      { writeConcern: { w: "majority" } });
  }
  return { mediaCleanup: combined };
}

async function createIdempotentSetDraft(setId, adminId, creationRequestId, input) {
  if (!validId(setId)) throw missing();
  if (!validId(adminId)) throw new QuizSetError(400, "Invalid Admin identity.", "invalid_quiz_creation_request");
  if (!validCreationRequestId(creationRequestId)) {
    throw new QuizSetError(400, "A canonical version-4 creationRequestId is required.", "invalid_quiz_creation_request");
  }
  await requireCreationIndex();
  const { hash: payloadHash, unhashable } = creationPayloadHash(input);
  const key = { adminId: new mongoose.Types.ObjectId(String(adminId)),
    quizSetId: new mongoose.Types.ObjectId(String(setId)), creationRequestId };
  const previousRecord = await readCommittedCreation(key);
  if (previousRecord?.status === "failed" || previousRecord?.status === "abandoned") {
    throw new QuizSetError(409, "This creation request ID belongs to a media request.", "quiz_creation_request_reused");
  }
  const previous = await replayCreation(previousRecord, payloadHash);
  if (previous) return previous;
  if (unhashable) throw new QuizSetError(400, "Invalid draft.", "invalid_quiz_draft");
  const fields = checkedDraftFields(input);

  try {
    return await runStandaloneTransaction(async (session) => {
      const existing = await QuizCreationRequest.findOne(key).session(session);
      if (existing?.status === "failed" || existing?.status === "abandoned") {
        throw new QuizSetError(409, "This creation request ID belongs to a media request.", "quiz_creation_request_reused");
      }
      const replayed = await replayCreation(existing, payloadHash, session);
      if (replayed) return replayed;
      const quiz = await createSetDraftInSession(setId, fields, session);
      const response = { id: String(quiz._id), quizSetId: String(quiz.quizSet), status: quiz.status,
        sortOrder: quiz.sortOrder, draft: quiz.draft.toObject() };
      await QuizCreationRequest.create([{ ...key, payloadHash, quizId: quiz._id,
        responseSnapshot: response }], { session });
      return response;
    }, { resolveAmbiguous: async () => replayCreation(await readCommittedCreation(key), payloadHash) });
  } catch (error) {
    if (error instanceof StandaloneTransactionConflict || error?.code === 11000) {
      // A concurrent winner may have committed. A bounded majority read can
      // confirm it; absence cannot prove the winner aborted.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const resolved = await replayCreation(await readCommittedCreation(key), payloadHash);
          if (resolved) return resolved;
        } catch (lookupError) {
          if (lookupError?.code === "quiz_creation_request_reused") throw lookupError;
        }
      }
      throw new QuizCreationOutcomeUnknown();
    }
    if (error instanceof StandaloneTransactionOutcomeUnknown) throw new QuizCreationOutcomeUnknown();
    throw error;
  }
}

// Keep the JSON creation contract above unchanged. Media-bearing creation uses
// the same ledger, but hashes file contents as well as the draft before upload.
async function createIdempotentSetDraftWithMedia(setId, adminId, creationRequestId, input, files) {
  if (!validId(setId)) throw missing();
  if (!validId(adminId) || !validCreationRequestId(creationRequestId)) {
    throw new QuizSetError(400, "Invalid creation request.", "invalid_quiz_creation_request");
  }
  if (!Array.isArray(files) || !files.length || files.length > 20) throw invalid("Invalid question media count.");
  const manifest = files.map((file) => ({ field: file.fieldname, type: file.mimetype,
    bytes: file.buffer?.length, digest: file.buffer && createHash("sha256").update(file.buffer).digest("hex") }))
    .sort((a, b) => a.field.localeCompare(b.field));
  const { hash: payloadHash, unhashable } = creationPayloadHash({ draft: input, media: manifest });
  const key = { adminId: new mongoose.Types.ObjectId(String(adminId)),
    quizSetId: new mongoose.Types.ObjectId(String(setId)), creationRequestId };
  await requireCreationIndex();
  const previous = await replayCreation(await readCommittedCreation(key), payloadHash);
  if (previous) return previous;
  if (unhashable) throw new QuizSetError(400, "Invalid draft.", "invalid_quiz_draft");

  const fields = checkedDraftFields(input);
  const used = new Set();
  const assignments = files.map((file) => {
    const match = /^question(Image|Audio)_(\d+)$/.exec(file.fieldname || "");
    const index = match && Number(match[2]);
    if (!match || !Number.isSafeInteger(index) || index >= fields.questions.length
      || used.has(file.fieldname) || !Buffer.isBuffer(file.buffer)) {
      throw new QuizSetError(400, "Invalid question media mapping.", "invalid_quiz_media");
    }
    used.add(file.fieldname);
    return { file, index, type: match[1] === "Image" ? "image" : "audio" };
  });
  const quizId = new mongoose.Types.ObjectId();
  const prepared = { ...fields, questions: fields.questions.map((question) => {
    if (question._id || question.imageResourceType || question.imageFormat || question.audioResourceType || question.audioFormat) {
      throw new QuizSetError(400, "Invalid new question media.", "invalid_quiz_media");
    }
    return { ...question, _id: new mongoose.Types.ObjectId() };
  }) };
  // Validate media-only questions before any external upload. The temporary
  // markers are never persisted or accepted as owned media.
  const preview = { ...prepared, questions: prepared.questions.map((question, index) => ({ ...question,
    ...(assignments.some((item) => item.index === index && item.type === "image") ? { image: "pending-image" } : {}),
    ...(assignments.some((item) => item.index === index && item.type === "audio") ? { audio: "pending-audio" } : {}),
  })) };
  try {
    await new Quiz({ _id: quizId, contextType: "standalone", quizSet: setId,
      title: prepared.title, status: "draft", publishedRevision: null,
      draft: { ...preview, version: 1, basePublishedRevision: null } }).validate();
  } catch (_error) { throw new QuizSetError(400, "Check the quiz metadata and questions.", "invalid_quiz_draft"); }

  await retryAbandonedCreationMedia().catch(() => { /* A later request can retry cleanup. */ });

  const uploaded = [];
  let transactionStarted = false;
  let uploadOutcomeUnknown = false;
  async function cleanupOwnUploads() {
    let complete = true;
    for (const item of uploaded) {
      try {
        const record = item.record || await QuizMedia.findOneAndUpdate({ publicId: item.publicId },
          { $setOnInsert: item }, { upsert: true, returnDocument: "after" });
        if (!await cleanupQuizMedia(record)) complete = false;
      } catch (_error) { complete = false; /* A durable pending record remains retryable when available. */ }
    }
    return complete;
  }
  try {
    for (const { file, index, type } of assignments) {
      const resourceType = type === "image" ? "image" : "video";
      let result;
      try {
        result = await uploadStream(file.buffer, `arun_thai/quiz_media/${type === "image" ? "images" : "audio"}`,
          { resource_type: resourceType });
      } catch (error) { uploadOutcomeUnknown = true; throw error; }
      const item = { quiz: quizId, questionId: prepared.questions[index]._id, mediaType: type,
        publicId: result.public_id, resourceType: result.resource_type || resourceType,
        url: result.secure_url, format: result.format || "", bytes: file.buffer.length,
        cleanupState: "pending_cleanup" };
      uploaded.push(item);
      item.record = await QuizMedia.create(item);
      const question = prepared.questions[index];
      question[type] = item.url;
      question[`${type}PublicId`] = item.publicId;
      question[`${type}ResourceType`] = item.resourceType;
      question[`${type}Format`] = item.format;
    }
    transactionStarted = true;
    const response = await runStandaloneTransaction(async (session) => {
      const existing = await QuizCreationRequest.findOne(key).session(session);
      const replayed = await replayCreation(existing, payloadHash, session);
      if (replayed) return replayed;
      const quiz = await createSetDraftInSession(setId, prepared, session, quizId);
      await Quiz.updateOne({ _id: quizId }, { $set: { mediaReconciliationToken: new mongoose.Types.ObjectId().toString() } }, { session });
      const snapshot = { id: String(quiz._id), quizSetId: String(quiz.quizSet), status: quiz.status,
        sortOrder: quiz.sortOrder, draft: quiz.draft.toObject() };
      if (existing?.status === "failed") {
        const updated = await QuizCreationRequest.updateOne({ ...key, status: "failed", payloadHash },
          { $set: { status: "committed", quizId: quiz._id, responseSnapshot: snapshot },
            $unset: { mediaCleanup: "" } }, { session });
        if (updated.modifiedCount !== 1) throw new StandaloneTransactionConflict();
      } else {
        await QuizCreationRequest.create([{ ...key, payloadHash, quizId: quiz._id,
          responseSnapshot: snapshot }], { session });
      }
      return snapshot;
    }, { resolveAmbiguous: async () => replayCreation(await readCommittedCreation(key), payloadHash) });
    if (response.id !== String(quizId)) await cleanupOwnUploads();
    else {
      // A committed draft stays authoritative even if reconciliation must retry.
      try { await require("./standaloneQuizRevisions").retryMediaReconciliation(quizId); }
      catch (_error) { /* The committed draft and its recovery marker remain authoritative. */ }
    }
    return response;
  } catch (error) {
    if (!transactionStarted) {
      const cleanupComplete = await cleanupOwnUploads();
      // This attempt never entered the creation transaction. Still consult the
      // majority-read ledger: another request using the same key may have won.
      // A failed lookup must never be reported as a confirmed failure.
      const outcome = await recordFailedMediaCreation(key, payloadHash,
        cleanupComplete ? uploadOutcomeUnknown ? "unverified" : "complete" : "retry_required");
      if (outcome.replayed) return outcome.replayed;
      const failure = new QuizSetError(503, "Quiz creation failed before commit. Retry the same request manually.",
        "quiz_creation_precommit_failed");
      failure.mediaCleanup = outcome.mediaCleanup;
      throw failure;
    } else {
      let committed;
      try { committed = await replayCreation(await readCommittedCreation(key), payloadHash); }
      catch (lookupError) {
        if (["quiz_creation_request_reused", "quiz_creation_request_abandoned"].includes(lookupError?.code)) {
          await cleanupOwnUploads();
          throw lookupError;
        }
        // An uncertain commit must retain media until the ledger is resolved.
      }
      if (committed) {
        if (committed.id !== String(quizId)) await cleanupOwnUploads();
        return committed;
      }
      if (error?.status === 400 || error?.status === 404) await cleanupOwnUploads();
    }
    throw error;
  }
}

async function getCreationOutcome(setId, adminId, creationRequestId) {
  if (!validId(setId) || !validId(adminId) || !validCreationRequestId(creationRequestId)) throw missing();
  const key = { adminId: new mongoose.Types.ObjectId(String(adminId)),
    quizSetId: new mongoose.Types.ObjectId(String(setId)), creationRequestId };
  const record = await readCommittedCreation(key);
  if (record?.status === "failed" || record?.status === "abandoned") {
    return { status: record.status, ...(record.mediaCleanup ? { mediaCleanup: record.mediaCleanup } : {}) };
  }
  return record ? { status: "committed", quiz: await replayCreation(record, record.payloadHash) }
    : { status: "unresolved" };
}

async function abandonFailedCreation(setId, adminId, creationRequestId) {
  if (!validId(setId) || !validId(adminId) || !validCreationRequestId(creationRequestId)) throw missing();
  await requireCreationIndex();
  const key = { adminId: new mongoose.Types.ObjectId(String(adminId)),
    quizSetId: new mongoose.Types.ObjectId(String(setId)), creationRequestId };
  const updated = await QuizCreationRequest.findOneAndUpdate({ ...key, status: "failed" },
    { $set: { status: "abandoned" } }, { returnDocument: "after", writeConcern: { w: "majority" } });
  if (updated) return { status: "abandoned" };
  const record = await readCommittedCreation(key);
  if (!record) throw new QuizCreationOutcomeUnknown();
  if (record.status === "abandoned") return { status: "abandoned" };
  if (record.status === "failed") throw new QuizCreationOutcomeUnknown();
  return { status: "committed", quiz: await replayCreation(record, record.payloadHash) };
}

// A bounded follow-up pass for uploads whose process ended before a draft was
// committed. Never touch recent uploads, and let the shared reference checks
// decide whether a Cloudinary deletion is safe.
async function retryAbandonedCreationMedia() {
  const olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pending = await QuizMedia.find({ cleanupState: { $in: ["pending_cleanup", "cleanup_failed"] },
    createdAt: { $lt: olderThan } })
    .sort({ createdAt: 1 }).limit(20);
  for (const record of pending) {
    if (!await Quiz.exists({ _id: record.quiz })) await cleanupQuizMedia(record);
  }
}

async function deleteEmptySet(setId, expectedVersion, { env = process.env } = {}) {
  if (!validId(setId)) throw missing();
  if (!validVersion(expectedVersion)) throw invalid("expectedVersion is required.");
  // Loaded here to avoid a module-initialization cycle with QuizSetError.
  const covers = require("./quizSetCoverService");
  const CoverAsset = require("../models/quizSetCoverAssetModel");
  // Fail closed: member deletion and historical aggregate inspection require a separate policy.
  const committed = await runStandaloneTransaction(async (session) => {
    const set = await QuizSet.findById(setId).session(session);
    if (!set) throw missing();
    if (set.version !== expectedVersion) throw stale();
    if (set.status === "active") throw conflict("Disable the Set before deletion.");
    // Creation writes this same Set fence before inserting the Quiz and ledger.
    // Whichever transaction loses the write conflict retries against the
    // committed state, so a snapshot-only ledger lookup cannot race creation.
    const fenced = await writeSetFence(set, session);
    if (!fenced) throw new StandaloneTransactionConflict();
    if (await Quiz.exists({ quizSet: setId }).session(session)) throw conflict("A Set with quizzes cannot be deleted safely.", "quiz_set_has_members");
    if (await QuizCreationRequest.exists({ quizSetId: set._id,
      status: { $nin: ["failed", "abandoned"] } }).session(session)) {
      throw conflict("A Set with quiz creation requests cannot be permanently deleted.", "quiz_set_has_creation_requests");
    }
    // Queue the owned cover in this transaction. A failed ownership check aborts
    // both writes; Cloudinary is never called until after commit.
    const coverAssetId = await covers.queueSetCoverDeletion(set, session, { env });
    // No attempt can be associated with an empty Set in the current schema.
    const deleted = await QuizSet.deleteOne({ _id: setId, version: expectedVersion, runtimeFence: fenced.runtimeFence }, { session });
    if (deleted.deletedCount !== 1) throw new StandaloneTransactionConflict();
    return { deleted: true, coverAssetId };
  }, { resolveAmbiguous: async (value) => {
    if (await QuizSet.exists({ _id: setId })) return undefined;
    if (value.coverAssetId) {
      const asset = await CoverAsset.findById(value.coverAssetId).lean();
      if (!asset || String(asset.quizSet) !== String(setId)
        || !["cleanup_pending", "cleanup_processing", "deleted"].includes(asset.state)) return undefined;
    }
    return value;
  } });
  if (!committed.coverAssetId) return { deleted: true };
  // A cleanup failure cannot undo the committed Set deletion. The transactional
  // pending record remains available to the operator retry command.
  let mediaCleanup = "retry_required";
  try {
    const asset = await CoverAsset.findById(committed.coverAssetId);
    if (asset?.state === "deleted" || asset && await covers.cleanupCoverAsset(asset, { env })) mediaCleanup = "complete";
  } catch (_error) { /* The durable handoff remains authoritative. */ }
  return { deleted: true, mediaCleanup };
}

function publicSet(set) {
  return { id: String(set._id), name: set.name, description: set.description || "",
    coverImage: set.coverImage || "", difficulty: set.difficulty || null, displayOrder: set.displayOrder };
}

module.exports = { QuizSetError, metadata, writeSetFence, fenceActiveSetForQuiz, createSet, updateSet,
  transitionSet, orderQuiz, createSetDraft, createIdempotentSetDraft,
  createIdempotentSetDraftWithMedia, getCreationOutcome, abandonFailedCreation, deleteEmptySet, publicSet };
