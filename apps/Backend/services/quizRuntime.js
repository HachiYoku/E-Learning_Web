const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizAttemptGrant = require("../models/quizAttemptGrantModel");
const QuizGoalAchievement = require("../models/quizGoalAchievementModel");
const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");
const HomeworkSet = require("../models/homeworkSetModel");
const { buildQuizSubmissionSnapshot } = require("./quizSubmissionSnapshot");
const { authorizeStudentQuizAccess, QuizAccessError, unavailableQuizError } = require("./quizAccessPolicy");
const { recoverCourseFinalUnlocks } = require("./courseFinalProgress");
const { loadSubmissionSession } = require("./quizSessionService");

class QuizSubmissionError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const FINAL_CONTEXTS = new Set(["course_final", "homework_final"]);
const isFinalQuiz = (quiz) => FINAL_CONTEXTS.has(quiz.contextType);

function revealedCorrectAnswerQuery(quizId, userId) {
  return {
    quiz: quizId,
    user: userId,
    $or: [
      { correctAnswersRevealed: true },
      // Phase 2 stored complete snapshots and returned them to students before
      // this marker existed. Keep that already-disclosed review available.
      { correctAnswersRevealed: { $exists: false }, "submissionSnapshot.questions.0": { $exists: true } },
    ],
  };
}

function validateAnswers(quiz, answers) {
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    throw new QuizSubmissionError(400, "Submit one valid answer for every question.", "invalid_quiz_answers");
  }
  const normalized = answers.map(Number);
  const invalid = quiz.questions.some((question, index) => !Number.isInteger(normalized[index]) || normalized[index] < 0 || normalized[index] >= question.options.length);
  if (invalid) throw new QuizSubmissionError(400, "Submit one valid answer for every question.", "invalid_quiz_answers");
  return normalized;
}

function safeQuizProjection(quiz, attemptsUsed, effectiveMaxAttempts) {
  const contextValue = (value) => value ? { id: String(value._id || value), title: String(value.title || "") } : null;
  return {
    _id: quiz._id,
    id: String(quiz._id),
    title: quiz.title,
    contextType: quiz.contextType,
    quizType: quiz.quizType,
    revision: quiz.revision,
    maxAttempts: effectiveMaxAttempts,
    attemptsUsed,
    courseContext: contextValue(quiz.course),
    lessonContext: contextValue(quiz.lesson),
    questions: quiz.questions.map((question) => ({
      _id: question._id,
      prompt: question.prompt,
      image: question.image,
      imageAlt: question.imageAlt || "",
      imageDecorative: Boolean(question.imageDecorative),
      audio: question.audio,
      audioLabel: question.audioLabel || "",
      options: question.options,
    })),
  };
}

async function attemptAllowance({ quiz, userId, session }) {
  if (!isFinalQuiz(quiz)) return null;
  const [grants, attempts] = await Promise.all([
    QuizAttemptGrant.countDocuments({ quiz: quiz._id, user: userId }).session(session),
    QuizAttempt.countDocuments({ quiz: quiz._id, user: userId }).session(session),
  ]);
  const baseMaxAttempts = Number.isInteger(quiz.maxAttempts) ? quiz.maxAttempts : 3;
  return { attemptsUsed: attempts, effectiveMaxAttempts: baseMaxAttempts + grants };
}

async function loadSnapshotParents(quiz, session) {
  const [course, lesson, homeworkSet] = await Promise.all([
    quiz.course ? Course.findById(quiz.course).select("title").session(session).lean() : null,
    quiz.lesson ? Lesson.findById(quiz.lesson).select("title").session(session).lean() : null,
    quiz.homeworkSet ? HomeworkSet.findById(quiz.homeworkSet).select("title").session(session).lean() : null,
  ]);
  return { course, lesson, homeworkSet };
}

function submissionReview(attempt, { revealCorrectAnswers = true } = {}) {
  const questions = attempt.submissionSnapshot?.questions || [];
  return {
    score: attempt.score,
    total: attempt.total,
    attemptId: attempt._id,
    attemptNumber: attempt.attemptNumber,
    submittedAt: attempt.createdAt,
    review: questions.map((question) => ({
      questionId: question.questionId,
      selectedAnswer: question.selectedAnswer,
      ...(revealCorrectAnswers ? { correctAnswer: question.correctAnswer } : {}),
      isCorrect: question.isCorrect,
    })),
  };
}

function quizAtSessionRevision(quiz, quizSession) {
  const snapshot = quizSession.snapshot || {};
  return {
    ...quiz.toObject(),
    title: snapshot.title || quiz.title,
    revision: quizSession.revision,
    questions: (snapshot.questions || []).map((question) => ({
      ...question,
      _id: question.questionId,
    })),
  };
}

async function submitQuiz({ quizId, user, submittedRevision, sessionId, answers }) {
  const userId = user?.id || user?._id;
  if (!userId) throw new QuizSubmissionError(401, "User is not authorized.", "quiz_unauthorized");
  if (!mongoose.isValidObjectId(quizId)) throw unavailableQuizError();

  for (let retry = 0; retry < 4; retry += 1) {
    try {
      return await mongoose.connection.transaction(async (session) => {
        const quiz = await Quiz.findById(quizId).session(session);
        await authorizeStudentQuizAccess({ quiz, user, session, requireAvailable: true });
        const quizSession = await loadSubmissionSession({ sessionId, quiz, user, session });
        if (!Number.isInteger(Number(submittedRevision)) || Number(submittedRevision) !== quizSession.revision) {
          throw new QuizSubmissionError(409, "The quiz session is no longer valid. Please reload and start again.", "invalid_quiz_session");
        }
        const sessionQuiz = quizAtSessionRevision(quiz, quizSession);

        const normalizedAnswers = validateAnswers(sessionQuiz, answers);
        const allowance = await attemptAllowance({ quiz, userId, session });
        if (allowance && allowance.attemptsUsed >= allowance.effectiveMaxAttempts) {
          throw new QuizSubmissionError(403, "No final quiz attempts remain.", "quiz_attempt_limit_reached");
        }

        const answersAlreadyRevealed = isFinalQuiz(quiz) && quiz.contextType !== "course_final"
          ? Boolean(await QuizAttempt.exists(revealedCorrectAnswerQuery(quiz._id, userId)).session(session))
          : false;
        const score = sessionQuiz.questions.reduce((total, question, index) => total + (question.correctAnswer === normalizedAnswers[index] ? 1 : 0), 0);
        const parents = await loadSnapshotParents(quiz, session);
        const submittedAt = new Date();
        const snapshot = buildQuizSubmissionSnapshot({
          quiz: sessionQuiz,
          answers: normalizedAnswers,
          score,
          total: sessionQuiz.questions.length,
          submittedAt,
          ...parents,
        });
        const attemptNumber = (allowance?.attemptsUsed || await QuizAttempt.countDocuments({ quiz: quiz._id, user: userId }).session(session)) + 1;
        const revealCorrectAnswers = quiz.contextType !== "course_final" && (
          !isFinalQuiz(quiz) || answersAlreadyRevealed || attemptNumber >= allowance.effectiveMaxAttempts
        );
        const [attempt] = await QuizAttempt.create([{
          quiz: quiz._id,
          user: userId,
          attemptNumber,
          answers: normalizedAnswers,
          score,
          total: sessionQuiz.questions.length,
          correctAnswersRevealed: revealCorrectAnswers && isFinalQuiz(quiz),
          submissionSnapshot: snapshot,
          createdAt: submittedAt,
        }], { session });

        if (quiz.contextType === "course_lesson") {
          // A learner's completed submission is authoritative. If recovery
          // unexpectedly fails, the next Final-state request will retry it.
          try {
            await recoverCourseFinalUnlocks({ courseId: quiz.course, userId, session });
          } catch (error) {
            console.error("Course final unlock recovery after lesson submission failed", { name: error?.name });
          }
        }

        const scorePercent = sessionQuiz.questions.length ? (score / sessionQuiz.questions.length) * 100 : 0;
        if (isFinalQuiz(quiz) && quiz.goalPercent !== null && scorePercent >= quiz.goalPercent) {
          const existing = await QuizGoalAchievement.exists({ user: userId, quiz: quiz._id }).session(session);
          if (!existing) {
            await QuizGoalAchievement.create([{
              user: userId,
              quiz: quiz._id,
              goalPercentAtAchievement: quiz.goalPercent,
              scorePercentAtAchievement: scorePercent,
            }], { session });
          }
        }

        const attemptsUsed = attemptNumber;
        return {
          ...submissionReview(attempt, { revealCorrectAnswers }),
          attemptsUsed,
          maxAttempts: allowance ? allowance.effectiveMaxAttempts : null,
          timesTaken: attemptsUsed,
        };
      });
    } catch (error) {
      if (error?.code === 11000 && retry < 3) continue;
      throw error;
    }
  }
  throw new QuizSubmissionError(409, "Please try submitting the quiz again.", "quiz_submission_conflict");
}

async function studentQuizHistory({ quizId, user }) {
  if (!mongoose.isValidObjectId(quizId)) throw unavailableQuizError();
  const quiz = await Quiz.findById(quizId);
  await authorizeStudentQuizAccess({ quiz, user, requireAvailable: false });
  const attempts = await QuizAttempt.find({ quiz: quiz._id, user: user.id || user._id })
    .select("attemptNumber answers score total createdAt submissionSnapshot")
    .sort({ attemptNumber: 1 })
    .lean();
  const correctAnswersRevealed = quiz.contextType !== "course_final" && (
    !isFinalQuiz(quiz) || Boolean(await QuizAttempt.exists(revealedCorrectAnswerQuery(quiz._id, user.id || user._id)))
  );
  const bestScore = attempts.reduce((best, attempt) => Math.max(best, attempt.total ? (attempt.score / attempt.total) * 100 : 0), 0);
  const allowance = await attemptAllowance({ quiz, userId: user.id || user._id });
  return {
    attempts: attempts.map((attempt) => ({
      _id: attempt._id,
      attemptNumber: attempt.attemptNumber,
      answers: attempt.answers,
      score: attempt.score,
      total: attempt.total,
      createdAt: attempt.createdAt,
      review: attempt.submissionSnapshot ? submissionReview(attempt, { revealCorrectAnswers: correctAnswersRevealed }).review : null,
      snapshot: attempt.submissionSnapshot ? {
        title: attempt.submissionSnapshot.quizTitle,
        revision: attempt.submissionSnapshot.quizRevision,
        contextType: attempt.submissionSnapshot.contextType,
        questions: (attempt.submissionSnapshot.questions || []).map((question) => ({
          _id: question.questionId,
          prompt: question.prompt,
          options: question.options,
          image: question.image?.url || "",
          imageAlt: question.imageAlt || "",
          imageDecorative: Boolean(question.imageDecorative),
          audio: question.audio?.url || "",
          audioLabel: question.audioLabel || "",
        })),
      } : null,
    })),
    attemptsUsed: attempts.length,
    timesTaken: attempts.length,
    maxAttempts: allowance?.effectiveMaxAttempts ?? null,
    bestScore,
  };
}

async function studentQuizProjection({ quiz, user, session }) {
  await authorizeStudentQuizAccess({ quiz, user, session, requireAvailable: true });
  const allowance = await attemptAllowance({ quiz, userId: user.id || user._id, session });
  const attemptsUsed = allowance?.attemptsUsed ?? await QuizAttempt.countDocuments({ quiz: quiz._id, user: user.id || user._id }).session(session || null);
  return safeQuizProjection(quiz, attemptsUsed, allowance?.effectiveMaxAttempts ?? null);
}

function statusForError(error) {
  return error instanceof QuizSubmissionError || error instanceof QuizAccessError ? error.status : 500;
}

module.exports = { submitQuiz, studentQuizHistory, studentQuizProjection, safeQuizProjection, QuizSubmissionError, statusForError };
