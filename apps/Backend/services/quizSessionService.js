const crypto = require("crypto");
const QuizSession = require("../models/quizSessionModel");
const Quiz = require("../models/quizModel");
const mongoose = require("mongoose");
const { authorizeStudentQuizAccess, unavailableQuizError } = require("./quizAccessPolicy");

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function sessionSnapshot(quiz) {
  return {
    title: String(quiz.title || ""),
    revision: Number(quiz.revision || 1),
    questions: (quiz.questions || []).map((question) => ({
      questionId: question._id,
      prompt: String(question.prompt || ""),
      image: question.image || "",
      imagePublicId: question.imagePublicId || "",
      imageResourceType: question.imageResourceType || "image",
      imageFormat: question.imageFormat || "",
      imageAlt: question.imageAlt || "",
      imageDecorative: Boolean(question.imageDecorative),
      audio: question.audio || "",
      audioPublicId: question.audioPublicId || "",
      audioResourceType: question.audioResourceType || "video",
      audioFormat: question.audioFormat || "",
      audioLabel: question.audioLabel || "",
      options: (question.options || []).map(String),
      correctAnswer: Number(question.correctAnswer),
    })),
  };
}

async function startQuizSession({ quizId, user }) {
  const userId = user?.id || user?._id;
  if (!userId) throw unavailableQuizError();
  if (!mongoose.isValidObjectId(quizId)) throw unavailableQuizError();
  const quiz = await Quiz.findById(quizId);
  await authorizeStudentQuizAccess({ quiz, user, requireAvailable: true });
  const now = new Date();
  const session = await QuizSession.create({
    user: userId,
    quiz: quiz._id,
    revision: quiz.revision,
    contextType: quiz.contextType,
    snapshot: sessionSnapshot(quiz),
    startedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
  });
  return {
    sessionId: String(session._id), revision: session.revision, expiresAt: session.expiresAt,
    title: session.snapshot.title,
    // Render exactly what will be graded, without disclosing the answer key or
    // internal asset identifiers to a student.
    questions: session.snapshot.questions.map((question) => ({
      _id: question.questionId, prompt: question.prompt, options: question.options,
      image: question.image, imageAlt: question.imageAlt, imageDecorative: question.imageDecorative,
      audio: question.audio, audioLabel: question.audioLabel,
    })),
  };
}

async function loadSubmissionSession({ sessionId, quiz, user, session }) {
  const userId = user?.id || user?._id;
  if (!mongoose.isValidObjectId(sessionId) || !userId) throw unavailableQuizError();
  const quizSession = await QuizSession.findOne({ _id: sessionId, quiz: quiz._id, user: userId }).session(session || null);
  if (!quizSession) throw unavailableQuizError();
  if (quizSession.invalidatedAt || quizSession.expiresAt <= new Date()) {
    const error = unavailableQuizError();
    error.status = 409;
    error.code = quizSession.invalidatedAt ? "quiz_session_invalidated" : "quiz_session_expired";
    error.message = "This quiz session has expired or is no longer available. Your answers were not submitted.";
    throw error;
  }
  return quizSession;
}

async function invalidateQuizSessions({ quizId, reason, session }) {
  return QuizSession.updateMany(
    { quiz: quizId, expiresAt: { $gt: new Date() }, invalidatedAt: null },
    { $set: { invalidatedAt: new Date(), invalidationReason: String(reason || "updated") } },
    { session: session || undefined }
  );
}

function requestToken() { return crypto.randomUUID(); }

module.exports = { SESSION_DURATION_MS, sessionSnapshot, startQuizSession, loadSubmissionSession, invalidateQuizSessions, requestToken };
