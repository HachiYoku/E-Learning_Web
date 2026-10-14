const Quiz = require("../models/quizModel");
const mongoose = require("mongoose");
const QuizSet = require("../models/quizSetModel");
const { startOrResumeStandaloneQuizSession } = require("../services/standaloneQuizSessionService");
const { submitStandaloneQuiz, getStandaloneAttemptResult, getStandaloneAttemptHistoryPage } =
  require("../services/standaloneQuizSubmissionService");
const {
  StandaloneQuizError, saveDraft, publishDraft, changeAvailability,
  deleteDraftOrQuiz, loadStandalone, publicSummary, retryMediaReconciliation,
} = require("../services/standaloneQuizRevisions");

function respondError(res, error) {
  if (error instanceof StandaloneQuizError) return res.status(error.status).json({ message: error.message, code: error.code });
  console.error("Standalone quiz request failed", { name: error?.name });
  return res.status(500).json({ message: "Unable to process the quiz request." });
}

function adminProjection(quiz) {
  // retry_required means the Quiz write committed. The Admin should POST to
  // /admin/standalone/:quizId/media/retry, not repeat draft save/publication.
  // After an ambiguous transport failure, reload this projection first.
  return {
    id: String(quiz._id), contextType: "standalone", status: quiz.status,
    mediaProcessing: quiz.mediaReconciliationToken ? "retry_required" : "complete",
    published: quiz.publishedRevision === null ? null : {
      title: quiz.title, description: quiz.description || "", category: quiz.category,
      difficulty: quiz.difficulty, standaloneAccess: quiz.standaloneAccess,
      questions: quiz.questions, revision: quiz.publishedRevision,
    },
    draft: quiz.draft || null,
  };
}

const create = async (req, res) => {
  try {
    // New drafts must use the Set-scoped endpoint. Retain the underlying
    // revision service for pre-existing standalone records and isolated tests.
    return res.status(400).json({ message: "Create a Quiz Set draft through its Set endpoint.", code: "quiz_set_required" });
  }
  catch (error) { return respondError(res, error); }
};

const getAdmin = async (req, res) => {
  try { return res.json(adminProjection(await loadStandalone(req.params.quizId))); }
  catch (error) { return respondError(res, error); }
};

const listAdmin = async (_req, res) => {
  try {
    const quizzes = await Quiz.find({ contextType: "standalone" }).sort({ createdAt: -1 });
    return res.json({ quizzes: quizzes.map(adminProjection) });
  } catch (error) { return respondError(res, error); }
};

const editDraft = async (req, res) => {
  try { return res.json(adminProjection(await saveDraft(req.params.quizId, req.body?.expectedVersion, req.body?.draft))); }
  catch (error) { return respondError(res, error); }
};

const publish = async (req, res) => {
  try { return res.json(adminProjection(await publishDraft(req.params.quizId, req.body?.expectedVersion))); }
  catch (error) { return respondError(res, error); }
};

const retryMedia = async (req, res) => {
  try { return res.json(adminProjection(await retryMediaReconciliation(req.params.quizId))); }
  catch (error) { return respondError(res, error); }
};

const lifecycle = (action) => async (req, res) => {
  try { return res.json(adminProjection(await changeAvailability(req.params.quizId, action))); }
  catch (error) { return respondError(res, error); }
};

const remove = async (req, res) => {
  try { return res.json(await deleteDraftOrQuiz(req.params.quizId)); }
  catch (error) { return respondError(res, error); }
};

const listPublished = async (req, res) => {
  try {
    const access = req.user ? { $in: ["public", "students"] } : "public";
    const activeSetIds = await QuizSet.distinct("_id", { status: "active" });
    const quizzes = await Quiz.find({ contextType: "standalone", status: "published", publishedRevision: { $type: "number" },
      standaloneAccess: access, $or: [{ quizSet: null }, { quizSet: { $in: activeSetIds } }] })
      .select("title description category difficulty standaloneAccess publishedRevision")
      .sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ quizzes: quizzes.map(publicSummary) });
  } catch (error) { return respondError(res, error); }
};

const getPublished = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(404).json({ message: "Quiz is unavailable." });
    const access = req.user ? { $in: ["public", "students"] } : "public";
    const quiz = await Quiz.findOne({ _id: req.params.quizId, contextType: "standalone", status: "published",
      publishedRevision: { $type: "number" }, standaloneAccess: access })
      .select("title description category difficulty standaloneAccess publishedRevision quizSet").lean();
    if (!quiz) return res.status(404).json({ message: "Quiz is unavailable." });
    if (quiz.quizSet && !await QuizSet.exists({ _id: quiz.quizSet, status: "active" })) {
      return res.status(404).json({ message: "Quiz is unavailable." });
    }
    return res.json(publicSummary(quiz));
  } catch (error) { return respondError(res, error); }
};

function runtimeError(res, error) {
  if ([400, 404, 409, 503].includes(error?.status) && typeof error.code === "string") {
    return res.status(error.status).json({ message: error.message, code: error.code });
  }
  console.error("Standalone runtime request failed", { name: error?.name });
  return res.status(503).json({ message: "General Practice is temporarily unavailable.",
    code: "standalone_runtime_unavailable" });
}

const startSession = async (req, res) => {
  try {
    const result = await startOrResumeStandaloneQuizSession({ quizId: req.params.quizId, user: req.user });
    return res.status(result.created ? 201 : 200).json(result);
  } catch (error) { return runtimeError(res, error); }
};

const submit = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)
    || !mongoose.isValidObjectId(body.sessionId)) {
    return res.status(400).json({ message: "Invalid Quiz submission.", code: "invalid_quiz_submission" });
  }
  try {
    return res.json(await submitStandaloneQuiz({ quizId: req.params.quizId, user: req.user,
      sessionId: body.sessionId, submittedRevision: body.revision, answers: body.answers }));
  } catch (error) { return runtimeError(res, error); }
};

const getResult = async (req, res) => {
  try { return res.json(await getStandaloneAttemptResult({ attemptId: req.params.attemptId, user: req.user })); }
  catch (error) { return runtimeError(res, error); }
};

const getHistory = async (req, res) => {
  try { return res.json(await getStandaloneAttemptHistoryPage({ quizId: req.params.quizId, user: req.user,
    limit: req.query.limit, before: req.query.before })); }
  catch (error) { return runtimeError(res, error); }
};

module.exports = { create, getAdmin, listAdmin, editDraft, publish, retryMedia, lifecycle, remove,
  listPublished, getPublished, startSession, submit, getResult, getHistory };
