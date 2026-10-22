const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");
const QuizSession = require("../models/quizSessionModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizSet = require("../models/quizSetModel");
const { fenceActiveSetForQuiz } = require("./standaloneQuizSets");
const { unavailableQuizError } = require("./quizAccessPolicy");
const { buildQuizSubmissionSnapshot } = require("./quizSubmissionSnapshot");
const { runStandaloneTransaction, writeQuizFence, StandaloneTransactionConflict } = require("./standaloneQuizTransactions");

class StandaloneSubmissionError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const invalidSession = () => new StandaloneSubmissionError(409,
  "This quiz session has expired or is no longer available. Your answers were not submitted.",
  "quiz_session_unavailable");
const invalidAnswers = () => new StandaloneSubmissionError(400,
  "Submit one valid answer for every question.", "invalid_quiz_answers");
const invalidHistory = () => new StandaloneSubmissionError(409,
  "This saved quiz result requires review.", "standalone_result_invalid");

function trustedUserId(user) {
  const userId = user?.id || user?._id;
  if (!mongoose.isValidObjectId(userId) || !["user", "admin"].includes(user?.role)) throw unavailableQuizError();
  return userId;
}

function validSnapshot(session) {
  const questions = session?.snapshot?.questions;
  if (session.contextType !== "standalone" || !Number.isSafeInteger(session.revision)
    || session.revision < 1 || session.snapshot?.revision !== session.revision
    || !Array.isArray(questions) || questions.length < 1 || questions.length > 10) return false;
  const seen = new Set();
  return questions.every((question) => {
    const key = String(question?.questionId || "");
    if (!mongoose.isValidObjectId(key) || seen.has(key)) return false;
    seen.add(key);
    return Array.isArray(question.options) && question.options.length >= 2 && question.options.length <= 6
      && question.options.every((option) => typeof option === "string" && option.trim())
      && Number.isInteger(question.correctAnswer) && question.correctAnswer >= 0
      && question.correctAnswer < question.options.length
      && Boolean(String(question.prompt || "").trim() || question.image || question.audio);
  });
}

function validateAnswers(questions, answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw invalidAnswers();
  if (questions.some((question, index) => typeof answers[index] !== "number"
    || !Number.isInteger(answers[index]) || answers[index] < 0
    || answers[index] >= question.options.length)) throw invalidAnswers();
  return [...answers];
}

function validSavedAttempt(attempt, quizId) {
  const snapshot = attempt?.submissionSnapshot;
  return attempt && String(attempt.quiz) === String(quizId)
    && snapshot?.contextType === "standalone"
    && Number.isSafeInteger(snapshot.quizRevision) && snapshot.quizRevision > 0
    && Number.isSafeInteger(attempt.attemptNumber) && attempt.attemptNumber > 0
    && Number.isSafeInteger(attempt.score) && Number.isSafeInteger(attempt.total)
    && attempt.total > 0 && attempt.score >= 0 && attempt.score <= attempt.total
    && snapshot.score === attempt.score && snapshot.total === attempt.total
    && Array.isArray(attempt.answers) && attempt.answers.length === attempt.total
    && Array.isArray(snapshot.questions) && snapshot.questions.length === attempt.total
    && snapshot.questions.every((question, index) => Number.isInteger(question.selectedAnswer)
      && Number.isInteger(question.correctAnswer) && typeof question.isCorrect === "boolean"
      && Array.isArray(question.options) && question.options.length >= 2
      && question.selectedAnswer >= 0 && question.selectedAnswer < question.options.length
      && question.correctAnswer >= 0 && question.correctAnswer < question.options.length
      && question.selectedAnswer === attempt.answers[index]
      && question.isCorrect === (question.selectedAnswer === question.correctAnswer));
}

function projectStandaloneAttempt(attempt) {
  if (!validSavedAttempt(attempt, attempt?.quiz)) throw invalidHistory();
  const snapshot = attempt.submissionSnapshot;
  return {
    attemptId: String(attempt._id), quizId: String(attempt.quiz),
    attemptNumber: attempt.attemptNumber, completedAt: snapshot.submittedAt || attempt.createdAt,
    title: snapshot.quizTitle, revision: snapshot.quizRevision,
    score: attempt.score, total: attempt.total, percentage: (attempt.score / attempt.total) * 100,
    correctCount: attempt.score, incorrectCount: attempt.total - attempt.score,
    answers: [...attempt.answers],
    review: snapshot.questions.map((question) => ({
      questionId: question.questionId, prompt: question.prompt,
      options: question.options, selectedAnswer: question.selectedAnswer,
      correctAnswer: question.correctAnswer, isCorrect: question.isCorrect,
      explanation: question.explanation || "",
      image: question.image?.url || "", imageAlt: question.imageAlt || "",
      imageDecorative: Boolean(question.imageDecorative),
      audio: question.audio?.url || "", audioLabel: question.audioLabel || "",
    })),
  };
}

async function completedForSession(sessionId, userId, quizId, session) {
  const attempt = await QuizAttempt.findOne({ session: sessionId, user: userId }).session(session || null);
  if (!attempt) return null;
  if (!validSavedAttempt(attempt, quizId)) throw invalidHistory();
  return attempt;
}

async function submitStandaloneQuiz({ quizId, sessionId, user, submittedRevision, answers }) {
  const userId = trustedUserId(user);
  if (!mongoose.isValidObjectId(quizId) || !mongoose.isValidObjectId(sessionId)) throw unavailableQuizError();

  // This owner-scoped lookup must precede Quiz/session availability checks:
  // durable attempts outlive TTL sessions and Disabled/Archived Quiz states.
  const replay = await completedForSession(sessionId, userId, quizId);
  if (replay) return projectStandaloneAttempt(replay);

  // The durable replay above intentionally precedes payload validation: a
  // completed session returns its saved result even if retry answers differ.
  if (!Number.isSafeInteger(submittedRevision) || submittedRevision < 1 || !Array.isArray(answers)) {
    throw invalidAnswers();
  }

  const committed = await runStandaloneTransaction(async (session) => {
    const quiz = await Quiz.findOne({ _id: quizId, contextType: "standalone" }).session(session);
    if (!quiz) throw unavailableQuizError();
    const fenced = await writeQuizFence(quiz, session);
    if (!fenced) throw new StandaloneTransactionConflict();

    const existing = await completedForSession(sessionId, userId, quizId, session);
    if (existing) return existing;
    const set = await fenceActiveSetForQuiz(fenced, session);
    if (fenced.status !== "published" || !Number.isSafeInteger(fenced.publishedRevision)
      || fenced.publishedRevision < 1 || fenced.revision !== fenced.publishedRevision) throw unavailableQuizError();

    const now = new Date();
    const quizSession = await QuizSession.findOne({ _id: sessionId, quiz: fenced._id, user: userId,
      contextType: "standalone", activeSlot: true, invalidatedAt: null, expiresAt: { $gt: now } }).session(session);
    if (!quizSession) throw invalidSession();
    if (set && quizSession.setEpoch !== set.runtimeEpoch) throw invalidSession();
    if (!validSnapshot(quizSession) || !Number.isSafeInteger(submittedRevision)
      || submittedRevision !== quizSession.revision) throw invalidSession();

    const submittedAnswers = validateAnswers(quizSession.snapshot.questions, answers);
    const previous = await QuizAttempt.findOne({ quiz: fenced._id, user: userId })
      .sort({ attemptNumber: -1 }).select("attemptNumber").session(session);
    if (previous && (!Number.isSafeInteger(previous.attemptNumber) || previous.attemptNumber < 1
      || previous.attemptNumber === Number.MAX_SAFE_INTEGER)) throw invalidHistory();
    const attemptNumber = previous ? previous.attemptNumber + 1 : 1;
    const questions = quizSession.snapshot.questions;
    // The request array follows the displayed session order. Associate each
    // answer with its immutable snapshot question ID before scoring/review.
    const answersByQuestionId = new Map(questions.map((question, index) =>
      [String(question.questionId), submittedAnswers[index]]));
    const snapshotAnswers = questions.map((question) => answersByQuestionId.get(String(question.questionId)));
    const score = questions.reduce((total, question) => total +
      (question.correctAnswer === answersByQuestionId.get(String(question.questionId)) ? 1 : 0), 0);
    const submittedAt = new Date();
    const snapshotQuiz = {
      contextType: "standalone", title: quizSession.snapshot.title,
      revision: quizSession.revision,
      questions: questions.map((question) => ({ ...question, _id: question.questionId })),
    };
    const submissionSnapshot = buildQuizSubmissionSnapshot({ quiz: snapshotQuiz,
      answers: snapshotAnswers, score, total: questions.length, submittedAt });
    const [attempt] = await QuizAttempt.create([{
      quiz: fenced._id, user: userId, session: quizSession._id,
      attemptNumber, answers: snapshotAnswers, score, total: questions.length,
      submissionSnapshot, createdAt: submittedAt,
    }], { session });
    const released = await QuizSession.updateOne({ _id: quizSession._id, quiz: fenced._id, user: userId,
      contextType: "standalone", activeSlot: true, invalidatedAt: null,
      expiresAt: { $gt: new Date() } }, { $set: { activeSlot: false } }, { session });
    if (released.modifiedCount !== 1) throw invalidSession();
    return attempt;
  }, { resolveAmbiguous: async () => await completedForSession(sessionId, userId, quizId) || undefined });

  return projectStandaloneAttempt(committed);
}

async function getStandaloneAttemptResult({ attemptId, user }) {
  const userId = trustedUserId(user);
  if (!mongoose.isValidObjectId(attemptId)) throw unavailableQuizError();
  const attempt = await QuizAttempt.findOne({ _id: attemptId, user: userId,
    "submissionSnapshot.contextType": "standalone" });
  if (!attempt) throw unavailableQuizError();
  return projectStandaloneAttempt(attempt);
}

async function getStandaloneAttemptHistory({ quizId, user }) {
  const userId = trustedUserId(user);
  if (quizId !== undefined && !mongoose.isValidObjectId(quizId)) throw unavailableQuizError();
  const filter = { user: userId, "submissionSnapshot.contextType": "standalone",
    ...(quizId === undefined ? {} : { quiz: quizId }) };
  // Retained for internal callers; never perform an unbounded history read.
  const attempts = await QuizAttempt.find(filter).sort({ createdAt: -1, _id: -1 }).limit(20);
  return attempts.map(projectStandaloneAttempt);
}

const MAX_HISTORY_PAGE_SIZE = 20;
const DEFAULT_HISTORY_PAGE_SIZE = 10;

function parsePositiveInteger(value, maximum) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

async function getStandaloneAttemptHistoryPage({ quizId, user, limit, before }) {
  const userId = trustedUserId(user);
  if (!mongoose.isValidObjectId(quizId)) throw unavailableQuizError();
  const pageSize = limit === undefined ? DEFAULT_HISTORY_PAGE_SIZE : parsePositiveInteger(limit, MAX_HISTORY_PAGE_SIZE);
  const cursor = before === undefined ? null : parsePositiveInteger(before, Number.MAX_SAFE_INTEGER);
  if (!pageSize || (before !== undefined && !cursor)) {
    throw new StandaloneSubmissionError(400, "Invalid history pagination.", "invalid_history_pagination");
  }

  // A current published Quiz may show an empty history. Disabled/Archived Quiz
  // IDs are visible only to a user who actually owns a saved result for them.
  const ownership = { quiz: quizId, user: userId, "submissionSnapshot.contextType": "standalone" };
  const owned = await QuizAttempt.exists(ownership);
  if (!owned) {
    const available = await Quiz.findOne({ _id: quizId, contextType: "standalone", status: "published",
      publishedRevision: { $type: "number" }, standaloneAccess: { $in: ["public", "students"] } })
      .select("quizSet").lean();
    if (!available || (available.quizSet && !await QuizSet.exists({ _id: available.quizSet, status: "active" }))) {
      throw unavailableQuizError();
    }
  }

  // The existing unique { quiz, user, attemptNumber } index supports a reverse
  // keyset scan. New attempts have larger numbers and cannot shift later pages.
  // The existence predicate also makes the existing partial unique index
  // eligible for the first page (not only pages with a numeric cursor).
  const filter = { ...ownership, attemptNumber: { $exists: true, ...(cursor ? { $lt: cursor } : {}) } };
  const rows = await QuizAttempt.find(filter).sort({ attemptNumber: -1 }).limit(pageSize + 1);
  const hasMore = rows.length > pageSize;
  const page = rows.slice(0, pageSize);
  return { attempts: page.map(projectStandaloneAttempt), pageSize,
    nextCursor: hasMore ? String(page[page.length - 1].attemptNumber) : null };
}

module.exports = { StandaloneSubmissionError, submitStandaloneQuiz,
  getStandaloneAttemptResult, getStandaloneAttemptHistory, getStandaloneAttemptHistoryPage,
  validSnapshot, validateAnswers };
