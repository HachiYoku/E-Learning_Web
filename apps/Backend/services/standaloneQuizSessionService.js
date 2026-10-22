const mongoose = require("mongoose");
const { randomInt } = require("node:crypto");
const Quiz = require("../models/quizModel");
const QuizSession = require("../models/quizSessionModel");
const QuizSet = require("../models/quizSetModel");
const { fenceActiveSetForQuiz } = require("./standaloneQuizSets");
const { unavailableQuizError } = require("./quizAccessPolicy");
const { SESSION_DURATION_MS, sessionSnapshot } = require("./quizSessionService");
const { runStandaloneTransaction, writeQuizFence, StandaloneTransactionConflict } = require("./standaloneQuizTransactions");

function publishedQuizIsUsable(quiz) {
  return quiz?.contextType === "standalone" && quiz.status === "published"
    && Number.isSafeInteger(quiz.publishedRevision) && quiz.publishedRevision > 0
    && quiz.revision === quiz.publishedRevision
    && ["public", "students"].includes(quiz.standaloneAccess)
    && Array.isArray(quiz.questions) && quiz.questions.length > 0 && quiz.questions.length <= 10
    && quiz.questions.every((question) => Array.isArray(question.options)
      && question.options.length >= 2 && question.options.length <= 6
      && Number.isInteger(question.correctAnswer) && question.correctAnswer >= 0
      && question.correctAnswer < question.options.length);
}

function studentSession(session, created) {
  const snapshot = session.snapshot || {};
  return {
    sessionId: String(session._id), revision: session.revision, expiresAt: session.expiresAt,
    title: snapshot.title || "", created,
    questions: (snapshot.questions || []).map((question) => ({
      _id: question.questionId, prompt: question.prompt, options: question.options,
      image: question.image, imageAlt: question.imageAlt, imageDecorative: question.imageDecorative,
      audio: question.audio, audioLabel: question.audioLabel,
    })),
  };
}

function shuffleSnapshotQuestions(snapshot, chooseIndex = randomInt) {
  const questions = [...snapshot.questions];
  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swapIndex = chooseIndex(index + 1);
    [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
  }
  return { ...snapshot, questions };
}

async function startOrResumeStandaloneQuizSession({ quizId, user }) {
  const userId = user?.id || user?._id;
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(quizId)
    || !["user", "admin"].includes(user?.role)) {
    throw unavailableQuizError();
  }
  const resolveAmbiguous = async (result) => {
    if (!result) return undefined;
    const quiz = await Quiz.findOne({ _id: quizId, contextType: "standalone", status: "published" }).lean();
    if (!publishedQuizIsUsable(quiz)) return undefined;
    const set = quiz.quizSet ? await QuizSet.findOne({ _id: quiz.quizSet, status: "active" }).lean() : null;
    if (quiz.quizSet && !set) return undefined;
    const now = new Date();
    const persisted = await QuizSession.findOne({ _id: result.sessionId, quiz: quizId, user: userId,
      contextType: "standalone", activeSlot: true, invalidatedAt: null, expiresAt: { $gt: now },
      ...(set ? { setEpoch: set.runtimeEpoch } : {}) });
    return persisted ? studentSession(persisted, result.created) : undefined;
  };
  return runStandaloneTransaction(async (session) => {
    const quiz = await Quiz.findOne({ _id: quizId, contextType: "standalone" }).session(session);
    if (!publishedQuizIsUsable(quiz)) throw unavailableQuizError();
    const set = await fenceActiveSetForQuiz(quiz, session);
    const fenced = await writeQuizFence(quiz, session);
    if (!fenced) throw new StandaloneTransactionConflict();
    const now = new Date();
    const ownership = { quiz: quiz._id, user: userId, contextType: "standalone", activeSlot: true };
    await QuizSession.updateMany({ ...ownership,
      $or: [{ expiresAt: { $lte: now } }, { invalidatedAt: { $ne: null } },
        ...(set ? [{ setEpoch: { $ne: set.runtimeEpoch } }] : [])] },
    { $set: { activeSlot: false } }, { session });
    const existing = await QuizSession.findOne({ ...ownership, invalidatedAt: null, expiresAt: { $gt: now },
      ...(set ? { setEpoch: set.runtimeEpoch } : {}) }).session(session);
    if (existing) return studentSession(existing, false);
    const snapshot = shuffleSnapshotQuestions(sessionSnapshot(fenced));
    const [created] = await QuizSession.create([{
      user: userId, quiz: fenced._id, contextType: "standalone", activeSlot: true,
      ...(set ? { setEpoch: set.runtimeEpoch } : {}),
      revision: fenced.publishedRevision, snapshot, startedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
    }], { session });
    return studentSession(created, true);
  }, { resolveAmbiguous });
}

module.exports = { startOrResumeStandaloneQuizSession, publishedQuizIsUsable, studentSession,
  shuffleSnapshotQuestions };
