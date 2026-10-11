const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizMedia = require("../models/quizMediaModel");
const { cleanupQuizMedia } = require("./quizMediaLifecycle");
const quizMediaLifecycle = require("./quizMediaLifecycle");
const QuizSession = require("../models/quizSessionModel");
const { runStandaloneTransaction, writeQuizFence, StandaloneTransactionConflict,
  StandaloneTransactionOutcomeUnknown } = require("./standaloneQuizTransactions");

class StandaloneQuizError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const unavailable = () => new StandaloneQuizError(404, "Quiz is unavailable.", "quiz_unavailable");
const conflict = () => new StandaloneQuizError(409, "The quiz changed. Reload it before saving.", "stale_quiz_draft");

function draftFields(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new StandaloneQuizError(400, "Invalid draft.", "invalid_quiz_draft");
  const allowed = new Set(["title", "description", "category", "difficulty", "standaloneAccess", "questions"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new StandaloneQuizError(400, "Invalid draft field.", "invalid_quiz_draft");
  return Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)));
}

function draftFromPublished(quiz) {
  return {
    title: quiz.title,
    description: quiz.description || "",
    category: quiz.category,
    difficulty: quiz.difficulty,
    standaloneAccess: quiz.standaloneAccess,
    questions: quiz.questions.map((question) => question.toObject()),
    version: 0,
    basePublishedRevision: quiz.publishedRevision,
  };
}

async function validateOwnedMedia(quiz, questions, previousQuestions = []) {
  for (const question of questions) {
    for (const type of ["image", "audio"]) {
      const url = question[type];
      const publicId = question[`${type}PublicId`];
      if (!url && !publicId) continue;
      if (!url || !publicId) {
        // Keep a pre-existing legacy URL, but do not accept a new unowned URL.
        const previous = previousQuestions.find((item) => String(item._id) === String(question._id));
        if (!publicId && previous?.[type] === url && !previous?.[`${type}PublicId`]) continue;
        throw new StandaloneQuizError(400, "Use an owned Quiz media asset.", "invalid_quiz_media");
      }
      const owned = await QuizMedia.exists({ quiz: quiz._id, questionId: question._id, mediaType: type, publicId, url, cleanupState: { $ne: "deleted" } });
      if (!owned) throw new StandaloneQuizError(400, "Use an owned Quiz media asset.", "invalid_quiz_media");
    }
  }
}

async function validateDraft(quiz, data, previousQuestions = []) {
  if (!Array.isArray(data.questions) || data.questions.length < 1 || data.questions.length > 10) {
    throw new StandaloneQuizError(400, "Add between 1 and 10 questions.", "invalid_quiz_draft");
  }
  const candidate = new Quiz({
    _id: quiz._id, contextType: "standalone", status: quiz.status,
    title: quiz.title || data.title, revision: quiz.revision,
    publishedRevision: quiz.publishedRevision,
    draft: data,
  });
  try { await candidate.validate(); }
  catch (_error) { throw new StandaloneQuizError(400, "Check the quiz metadata and questions.", "invalid_quiz_draft"); }
  const normalized = candidate.draft.toObject();
  await validateOwnedMedia(quiz, normalized.questions, previousQuestions);
  return normalized;
}

async function loadStandalone(quizId, session) {
  if (!mongoose.isValidObjectId(quizId)) throw unavailable();
  const quiz = await Quiz.findOne({ _id: quizId, contextType: "standalone" }).session(session || null);
  if (!quiz) throw unavailable();
  if (["published", "disabled"].includes(quiz.status) && quiz.publishedRevision === null && !quiz.draft) {
    throw new StandaloneQuizError(409, "This legacy standalone quiz requires review before revision management.", "legacy_standalone_quiz");
  }
  return quiz;
}

async function createDraft(input) {
  const fields = draftFields(input);
  const quizId = new mongoose.Types.ObjectId();
  const shell = { _id: quizId, title: String(fields.title || ""), status: "draft", publishedRevision: null, revision: 1 };
  const normalized = await validateDraft(shell, { ...fields, version: 1, basePublishedRevision: null });
  const quiz = await Quiz.create({ ...shell, contextType: "standalone", questions: [], draft: normalized });
  await quizMediaLifecycle.registerQuizMedia(quiz);
  return quiz;
}

// A Quiz write is already committed when this runs. Keep the operation token
// durable on failure, and never turn a committed save into a false HTTP error.
async function finishMediaReconciliation(quiz, operation) {
  const token = quiz.mediaReconciliationToken;
  if (!token) return quiz;
  try {
    const current = await loadStandalone(quiz._id);
    if (current.mediaReconciliationToken !== token) return current;
    const complete = await quizMediaLifecycle.reconcileStandaloneQuizMedia(current);
    if (!complete) return current;
    const cleared = await Quiz.findOneAndUpdate(
      { _id: quiz._id, contextType: "standalone", mediaReconciliationToken: token },
      { $unset: { mediaReconciliationToken: "" } },
      { returnDocument: "after" }
    );
    return cleared || await loadStandalone(quiz._id);
  } catch (error) {
    console.error("Standalone quiz media reconciliation requires retry", {
      quizId: String(quiz._id), operation, name: error?.name || "Error",
    });
    // The committed document remains authoritative even if the database is
    // temporarily unavailable for a fresh read.
    return quiz;
  }
}

async function retryMediaReconciliation(quizId) {
  const quiz = await loadStandalone(quizId);
  return finishMediaReconciliation(quiz, "retry");
}

async function saveDraft(quizId, expectedVersion, input) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new StandaloneQuizError(400, "Provide a valid draft version.", "invalid_draft_version");
  const quiz = await loadStandalone(quizId);
  if (quiz.status === "archived") throw new StandaloneQuizError(409, "Archived quizzes cannot be edited.", "quiz_archived");
  const previous = quiz.draft?.toObject() || draftFromPublished(quiz);
  if (previous.version !== expectedVersion) throw conflict();
  const patch = draftFields(input);
  const normalized = await validateDraft(quiz, {
    ...previous, ...patch, version: expectedVersion + 1,
    basePublishedRevision: quiz.publishedRevision,
  }, [...(quiz.draft?.questions || []), ...quiz.questions]);
  const mediaReconciliationToken = new mongoose.Types.ObjectId().toString();
  const updated = await Quiz.findOneAndUpdate(
    { _id: quiz._id, contextType: "standalone", status: { $ne: "archived" }, publishedRevision: quiz.publishedRevision,
      ...(quiz.draft ? { "draft.version": expectedVersion } : { draft: { $exists: false } }) },
    { $set: { draft: normalized, mediaReconciliationToken } },
    { returnDocument: "after", runValidators: true }
  );
  if (!updated) throw conflict();
  return finishMediaReconciliation(updated, "save_draft");
}

async function publishDraft(quizId, expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new StandaloneQuizError(400, "Provide a valid draft version.", "invalid_draft_version");
  const quiz = await loadStandalone(quizId);
  if (quiz.status === "disabled") throw new StandaloneQuizError(409, "Re-enable the quiz before publishing its draft.", "quiz_disabled");
  if (quiz.status === "archived") throw new StandaloneQuizError(409, "Archived quizzes cannot be published.", "quiz_archived");
  if (!quiz.draft || quiz.draft.version !== expectedVersion || quiz.draft.basePublishedRevision !== quiz.publishedRevision) throw conflict();
  const draft = quiz.draft.toObject();
  const nextRevision = quiz.publishedRevision === null ? 1 : quiz.publishedRevision + 1;
  const live = {
    title: draft.title, description: draft.description, category: draft.category,
    difficulty: draft.difficulty, standaloneAccess: draft.standaloneAccess,
    questions: draft.questions, revision: nextRevision, publishedRevision: nextRevision, status: "published",
  };
  const candidate = new Quiz({ ...quiz.toObject(), ...live, draft: undefined });
  try { await candidate.validate(); }
  catch (_error) { throw new StandaloneQuizError(400, "Check the draft before publishing.", "invalid_quiz_draft"); }
  const mediaReconciliationToken = new mongoose.Types.ObjectId().toString();
  const updated = await Quiz.findOneAndUpdate(
    { _id: quiz._id, contextType: "standalone", status: { $in: ["draft", "published"] },
      "draft.version": expectedVersion, publishedRevision: quiz.publishedRevision },
    { $set: { ...live, mediaReconciliationToken }, $unset: { draft: "" } },
    { returnDocument: "after", runValidators: true }
  );
  if (!updated) throw conflict();
  return finishMediaReconciliation(updated, "publish_draft");
}

async function changeAvailability(quizId, action) {
  const transitions = { disable: ["published", "disabled"], enable: ["disabled", "published"], archive: [["draft", "published", "disabled"], "archived"] };
  const [from, to] = transitions[action] || [];
  if (!from) throw new StandaloneQuizError(400, "Invalid action.", "invalid_quiz_action");
  try {
    return await runStandaloneTransaction(async (session) => {
      const quiz = await loadStandalone(quizId, session);
      if (![].concat(from).includes(quiz.status)) {
        throw new StandaloneQuizError(409, "This quiz cannot make that status change.", "invalid_quiz_state");
      }
      if (action === "enable" && quiz.publishedRevision === null) {
        throw new StandaloneQuizError(409, "Publish the quiz first.", "quiz_unpublished");
      }
      const updated = await writeQuizFence(quiz, session, { status: to });
      if (!updated) throw new StandaloneTransactionConflict();
      if (action !== "enable") await invalidateStandaloneSessions(quiz._id, to, session);
      return updated;
    }, { resolveAmbiguous: async (result) => {
      if (!result) return undefined;
      const current = await Quiz.findOne({ _id: quizId, contextType: "standalone", status: to });
      return current && current.runtimeFence >= result.runtimeFence ? current : undefined;
    } });
  } catch (error) {
    if (error instanceof StandaloneTransactionConflict || error instanceof StandaloneTransactionOutcomeUnknown) {
      throw new StandaloneQuizError(error.status, error.message, error.code);
    }
    throw error;
  }
}

async function invalidateStandaloneSessions(quizId, reason, session) {
  const now = new Date();
  await QuizSession.updateMany(
    { quiz: quizId, contextType: "standalone", invalidatedAt: null, expiresAt: { $gt: now } },
    { $set: { invalidatedAt: now, invalidationReason: reason, activeSlot: false } }, { session }
  );
  await QuizSession.updateMany(
    { quiz: quizId, contextType: "standalone", activeSlot: true },
    { $set: { activeSlot: false } }, { session }
  );
}

async function deleteDraftOrQuiz(quizId) {
  try {
    await runStandaloneTransaction(async (session) => {
      const quiz = await loadStandalone(quizId, session);
      const fenced = await writeQuizFence(quiz, session);
      if (!fenced) throw new StandaloneTransactionConflict();
      if (await QuizAttempt.exists({ quiz: quiz._id }).session(session)) {
        throw new StandaloneQuizError(409, "This quiz has student results and cannot be permanently deleted. Archive it instead to preserve student history.", "quiz_has_history");
      }
      await invalidateStandaloneSessions(quiz._id, "deleted", session);
      // Durable recovery state precedes physical cleanup, which must run only
      // after the Quiz deletion is committed.
      await QuizMedia.updateMany({ quiz: quiz._id, cleanupState: { $ne: "deleted" } },
        { $set: { cleanupState: "pending_cleanup" } }, { session });
      const deleted = await Quiz.deleteOne({ _id: quiz._id, contextType: "standalone",
        runtimeFence: fenced.runtimeFence }, { session });
      if (!deleted.deletedCount) throw new StandaloneTransactionConflict();
      return { deleted: true };
    }, { resolveAmbiguous: async () => !(await Quiz.exists({ _id: quizId, contextType: "standalone" }))
      ? { deleted: true } : undefined });
  } catch (error) {
    if (error instanceof StandaloneTransactionConflict || error instanceof StandaloneTransactionOutcomeUnknown) {
      throw new StandaloneQuizError(error.status, error.message, error.code);
    }
    throw error;
  }
  try {
    const media = await QuizMedia.find({ quiz: quizId, cleanupState: { $ne: "deleted" } });
    const results = await Promise.all(media.map(cleanupQuizMedia));
    return results.every(Boolean) ? { deleted: true } : { deleted: true, mediaProcessing: "retry_required" };
  } catch (error) {
    console.error("Standalone quiz media cleanup requires retry", { quizId: String(quizId), name: error?.name || "Error" });
    return { deleted: true, mediaProcessing: "retry_required" };
  }
}

function publicSummary(quiz) {
  return { id: String(quiz._id), title: quiz.title, description: quiz.description || "", category: quiz.category,
    difficulty: quiz.difficulty, standaloneAccess: quiz.standaloneAccess, revision: quiz.publishedRevision };
}

module.exports = { StandaloneQuizError, createDraft, saveDraft, publishDraft, changeAvailability,
  deleteDraftOrQuiz, loadStandalone, publicSummary, retryMediaReconciliation };
