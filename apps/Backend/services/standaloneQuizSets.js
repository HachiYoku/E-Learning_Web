const mongoose = require("mongoose");
const { createHash } = require("node:crypto");
const QuizSet = require("../models/quizSetModel");
const Quiz = require("../models/quizModel");
const QuizCreationRequest = require("../models/quizCreationRequestModel");
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
  return QuizSet.create({ ...fields, status: "disabled" });
}

async function updateSet(setId, expectedVersion, input) {
  if (!validId(setId)) throw missing();
  if (!validVersion(expectedVersion)) throw invalid("expectedVersion is required.");
  const fields = metadata(input);
  if (!Object.keys(fields).length) throw invalid("No changes were supplied.");
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

async function createSetDraftInSession(setId, fields, session) {
  const set = await QuizSet.findById(setId).session(session);
  if (!set || set.status === "archived") throw missing();
  if (!await writeSetFence(set, session)) throw new StandaloneTransactionConflict();
  const last = await Quiz.findOne({ quizSet: setId, contextType: "standalone" }).sort({ sortOrder: -1, _id: -1 }).session(session);
  const quizId = new mongoose.Types.ObjectId();
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
  const previous = await replayCreation(await readCommittedCreation(key), payloadHash);
  if (previous) return previous;
  if (unhashable) throw new QuizSetError(400, "Invalid draft.", "invalid_quiz_draft");
  const fields = checkedDraftFields(input);

  try {
    return await runStandaloneTransaction(async (session) => {
      const existing = await QuizCreationRequest.findOne(key).session(session);
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

async function deleteEmptySet(setId, expectedVersion) {
  if (!validId(setId)) throw missing();
  if (!validVersion(expectedVersion)) throw invalid("expectedVersion is required.");
  // Fail closed: member deletion and historical aggregate inspection require a separate policy.
  return runStandaloneTransaction(async (session) => {
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
    if (await QuizCreationRequest.exists({ quizSetId: set._id }).session(session)) {
      throw conflict("A Set with quiz creation requests cannot be permanently deleted.", "quiz_set_has_creation_requests");
    }
    // No attempt can be associated with an empty Set in the current schema.
    const deleted = await QuizSet.deleteOne({ _id: setId, version: expectedVersion, runtimeFence: fenced.runtimeFence }, { session });
    if (deleted.deletedCount !== 1) throw new StandaloneTransactionConflict();
    return { deleted: true };
  }, { resolveAmbiguous: async () => !await QuizSet.exists({ _id: setId }) ? { deleted: true } : undefined });
}

function publicSet(set) {
  return { id: String(set._id), name: set.name, description: set.description || "",
    coverImage: set.coverImage || "", difficulty: set.difficulty || null, displayOrder: set.displayOrder };
}

module.exports = { QuizSetError, metadata, writeSetFence, fenceActiveSetForQuiz, createSet, updateSet,
  transitionSet, orderQuiz, createSetDraft, createIdempotentSetDraft, deleteEmptySet, publicSet };
