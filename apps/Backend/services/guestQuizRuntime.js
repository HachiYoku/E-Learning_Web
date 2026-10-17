const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");
const QuizSet = require("../models/quizSetModel");
const GuestQuizSession = require("../models/guestQuizSessionModel");
const GuestQuizAttempt = require("../models/guestQuizAttemptModel");
const { fenceActiveSetForQuiz } = require("./standaloneQuizSets");
const { writeQuizFence, runStandaloneTransaction, StandaloneTransactionConflict } = require("./standaloneQuizTransactions");
const { publishedQuizIsUsable, studentSession } = require("./standaloneQuizSessionService");
const { validSnapshot, validateAnswers } = require("./standaloneQuizSubmissionService");
const { sessionSnapshot } = require("./quizSessionService");
const { buildQuizSubmissionSnapshot } = require("./quizSubmissionSnapshot");
const { assertGuestPublicQuiz } = require("./guestQuizAccess");
const { unavailableQuizError } = require("./quizAccessPolicy");
const { SESSION_MS, RESULT_MS, guestSessionAvailable, guestResultAvailable } = require("./guestQuizSecurity");

const validOwner = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const unavailableSession = () => Object.assign(new Error("Guest quiz session unavailable."),
  { status: 409, code: "guest_quiz_session_unavailable" });
const invalidResult = () => Object.assign(new Error("Guest quiz result unavailable."),
  { status: 404, code: "guest_quiz_result_unavailable" });

function assertIdentifiers(quizId, ownerHash, sessionId) {
  if (!mongoose.isValidObjectId(quizId) || !validOwner(ownerHash)
    || (sessionId !== undefined && !mongoose.isValidObjectId(sessionId))) throw unavailableQuizError();
}

function projectGuestResult(attempt, ownerHash, now = new Date()) {
  if (!guestResultAvailable(attempt, ownerHash, now)) throw invalidResult();
  const snapshot = attempt.submissionSnapshot;
  const questions = snapshot?.questions;
  if (snapshot?.contextType !== "standalone" || !Number.isSafeInteger(snapshot.quizRevision)
    || snapshot.quizRevision < 1 || !Number.isSafeInteger(attempt.score)
    || !Number.isSafeInteger(attempt.total) || attempt.total < 1
    || attempt.score < 0 || attempt.score > attempt.total || snapshot.score !== attempt.score
    || snapshot.total !== attempt.total || !Array.isArray(attempt.answers)
    || attempt.answers.length !== attempt.total || !Array.isArray(questions)
    || questions.length !== attempt.total
    || questions.some((question, index) => !Array.isArray(question.options)
      || !Number.isInteger(question.selectedAnswer) || !Number.isInteger(question.correctAnswer)
      || question.selectedAnswer !== attempt.answers[index]
      || question.selectedAnswer < 0 || question.selectedAnswer >= question.options.length
      || question.correctAnswer < 0 || question.correctAnswer >= question.options.length
      || question.isCorrect !== (question.selectedAnswer === question.correctAnswer))) throw invalidResult();
  return {
    attemptId: String(attempt._id), quizId: String(attempt.quiz),
    completedAt: attempt.submittedAt, title: snapshot.quizTitle,
    revision: snapshot.quizRevision, score: attempt.score, total: attempt.total,
    percentage: (attempt.score / attempt.total) * 100,
    correctCount: attempt.score, incorrectCount: attempt.total - attempt.score,
    answers: [...attempt.answers],
    review: questions.map((question) => ({
      questionId: question.questionId, prompt: question.prompt, options: question.options,
      selectedAnswer: question.selectedAnswer, correctAnswer: question.correctAnswer,
      isCorrect: question.isCorrect, explanation: question.explanation || "",
      image: question.image?.url || "", imageAlt: question.imageAlt || "",
      imageDecorative: Boolean(question.imageDecorative),
      audio: question.audio?.url || "", audioLabel: question.audioLabel || "",
    })),
  };
}

async function completedForSession(quizId, sessionId, ownerHash, transaction) {
  const attempt = await GuestQuizAttempt.findOne({ quiz: quizId, session: sessionId, ownerHash })
    .session(transaction || null);
  return attempt ? projectGuestResult(attempt, ownerHash) : null;
}

async function startOrResumeGuestQuiz({ quizId, ownerHash }) {
  assertIdentifiers(quizId, ownerHash);
  return runStandaloneTransaction(async (transaction) => {
    const quiz = await Quiz.findOne({ _id: quizId, contextType: "standalone" }).session(transaction);
    if (!publishedQuizIsUsable(quiz)) throw unavailableQuizError();
    const set = await fenceActiveSetForQuiz(quiz, transaction);
    assertGuestPublicQuiz(quiz, set);
    const fenced = await writeQuizFence(quiz, transaction);
    if (!fenced) throw new StandaloneTransactionConflict();
    const now = new Date();
    const ownership = { quiz: quiz._id, ownerHash, activeSlot: true };
    await GuestQuizSession.updateMany({ ...ownership, $or: [
      { expiresAt: { $lte: now } }, { invalidatedAt: { $ne: null } },
      { setEpoch: { $ne: set.runtimeEpoch } },
      { revision: { $ne: fenced.publishedRevision } },
    ] }, { $set: { activeSlot: false } }, { session: transaction });
    const existing = await GuestQuizSession.findOne({ ...ownership, invalidatedAt: null,
      expiresAt: { $gt: now }, setEpoch: set.runtimeEpoch,
      revision: fenced.publishedRevision }).session(transaction);
    if (existing) {
      if (!guestSessionAvailable(existing, ownerHash, now) || !validSnapshot(existing)) throw unavailableSession();
      return studentSession(existing, false);
    }
    const snapshot = sessionSnapshot(fenced);
    const [created] = await GuestQuizSession.create([{
      ownerHash, quiz: fenced._id, revision: fenced.publishedRevision,
      setEpoch: set.runtimeEpoch, snapshot, startedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_MS), activeSlot: true,
    }], { session: transaction });
    return studentSession(created, true);
  }, { resolveAmbiguous: async (result) => {
    if (!result?.sessionId) return undefined;
    try { return { ...await getGuestQuizSession({ quizId, sessionId: result.sessionId, ownerHash }), created: result.created }; }
    catch (_error) { return undefined; }
  } });
}

async function getGuestQuizSession({ quizId, sessionId, ownerHash }) {
  assertIdentifiers(quizId, ownerHash, sessionId);
  const record = await GuestQuizSession.findOne({ _id: sessionId, quiz: quizId, ownerHash });
  if (!guestSessionAvailable(record, ownerHash)) throw unavailableSession();
  const quiz = await Quiz.findOne({ _id: quizId, contextType: "standalone" }).lean();
  const set = quiz?.quizSet ? await QuizSet.findById(quiz.quizSet).lean() : null;
  assertGuestPublicQuiz(quiz, set);
  // Any republish revokes an unfinished guest session. In particular, a
  // Public -> Students Only -> Public transition cannot revive old access.
  if (record.setEpoch !== set.runtimeEpoch || record.revision !== quiz.publishedRevision
    || !validSnapshot(record)) throw unavailableSession();
  return studentSession(record, false);
}

async function submitGuestQuiz({ quizId, sessionId, ownerHash, submittedRevision, answers }) {
  assertIdentifiers(quizId, ownerHash, sessionId);
  // Durable, owner-scoped replay precedes availability and payload checks.
  // Saved results remain available after Disable/Archive/access changes.
  const replay = await completedForSession(quizId, sessionId, ownerHash);
  if (replay) return replay;
  if (!Number.isSafeInteger(submittedRevision) || submittedRevision < 1 || !Array.isArray(answers)) {
    throw Object.assign(new Error("Invalid guest quiz answers."), { status: 400, code: "invalid_quiz_answers" });
  }
  return runStandaloneTransaction(async (transaction) => {
    const quiz = await Quiz.findOne({ _id: quizId, contextType: "standalone" }).session(transaction);
    if (!quiz) throw unavailableQuizError();
    const fenced = await writeQuizFence(quiz, transaction);
    if (!fenced) throw new StandaloneTransactionConflict();
    const saved = await completedForSession(quizId, sessionId, ownerHash, transaction);
    if (saved) return saved;
    const set = await fenceActiveSetForQuiz(fenced, transaction);
    assertGuestPublicQuiz(fenced, set);
    const now = new Date();
    const record = await GuestQuizSession.findOne({ _id: sessionId, quiz: fenced._id, ownerHash,
      activeSlot: true, invalidatedAt: null, expiresAt: { $gt: now } }).session(transaction);
    if (!guestSessionAvailable(record, ownerHash, now) || record.setEpoch !== set.runtimeEpoch
      || record.revision !== fenced.publishedRevision || !validSnapshot(record)
      || submittedRevision !== record.revision) throw unavailableSession();
    const submittedAnswers = validateAnswers(record.snapshot.questions, answers);
    const score = record.snapshot.questions.reduce((total, question, index) =>
      total + (question.correctAnswer === submittedAnswers[index] ? 1 : 0), 0);
    const submittedAt = new Date();
    const snapshotQuiz = { contextType: "standalone", title: record.snapshot.title,
      revision: record.revision,
      questions: record.snapshot.questions.map((question) => ({ ...question, _id: question.questionId })) };
    const submissionSnapshot = buildQuizSubmissionSnapshot({ quiz: snapshotQuiz,
      answers: submittedAnswers, score, total: submittedAnswers.length, submittedAt });
    const [attempt] = await GuestQuizAttempt.create([{
      quiz: fenced._id, session: record._id, ownerHash, answers: submittedAnswers,
      score, total: submittedAnswers.length, submissionSnapshot, submittedAt,
      expiresAt: new Date(submittedAt.getTime() + RESULT_MS),
    }], { session: transaction });
    const released = await GuestQuizSession.updateOne({ _id: record._id, quiz: fenced._id, ownerHash,
      activeSlot: true, invalidatedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { activeSlot: false } }, { session: transaction });
    if (released.modifiedCount !== 1) throw unavailableSession();
    return projectGuestResult(attempt, ownerHash);
  }, { resolveAmbiguous: async (result) => result?.attemptId
    ? await completedForSession(quizId, sessionId, ownerHash) || undefined : undefined });
}

async function getGuestQuizResult({ attemptId, ownerHash }) {
  if (!mongoose.isValidObjectId(attemptId) || !validOwner(ownerHash)) throw invalidResult();
  const attempt = await GuestQuizAttempt.findOne({ _id: attemptId, ownerHash });
  return projectGuestResult(attempt, ownerHash);
}

module.exports = { startOrResumeGuestQuiz, getGuestQuizSession, submitGuestQuiz,
  getGuestQuizResult, projectGuestResult };
