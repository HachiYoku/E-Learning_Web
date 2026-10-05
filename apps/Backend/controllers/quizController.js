const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");
const Quiz = require("../models/quizModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizAttemptGrant = require("../models/quizAttemptGrantModel");
const QuizGoalAchievement = require("../models/quizGoalAchievementModel");
const Enrollment = require("../models/enrollmentModel");
const User = require("../models/userModel");
const { writeAuditLog } = require("../services/auditLogger");
const { uploadStream } = require("../services/uploadStream");
const { submitQuiz: submitQuizRuntime, studentQuizHistory, studentQuizProjection, statusForError } = require("../services/quizRuntime");
const { courseFinalProgress } = require("../services/courseFinalProgress");

function studentQuizError(res, error) {
  const status = statusForError(error);
  if (status !== 500) return res.status(status).json({ message: error.message });
  console.error("Student quiz request failed", { name: error?.name });
  return res.status(500).json({ message: "Unable to process the quiz request." });
}

function parseQuestions(rawQuestions, files = []) {
  let questions = rawQuestions;
  if (typeof questions === "string") {
    try {
      questions = JSON.parse(questions);
    } catch {
      throw new Error("Questions must be valid JSON.");
    }
  }

  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 10) {
    throw new Error("Add between 1 and 10 questions to the quiz.");
  }

  return questions.map((question, index) => {
    const options = Array.isArray(question.options)
      ? question.options.map((option) => String(option || "").trim()).filter(Boolean)
      : [];
    const correctAnswer = Number(question.correctAnswer);
    const imageFile = files.find((file) => file.fieldname === `questionImage_${index}`);

    if (options.length < 2 || options.length > 6 || !Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      throw new Error(`Question ${index + 1} needs 2–6 options and one correct answer.`);
    }

    return {
      prompt: String(question.prompt || "").trim(),
      image: String(question.image || "").trim(),
      imagePublicId: question.imagePublicId,
      options,
      correctAnswer,
      imageFile,
    };
  });
}

async function uploadQuestionImages(questions) {
  return Promise.all(
    questions.map(async (question) => {
      if (question.imageFile) {
        const upload = await uploadStream(question.imageFile.buffer, "english_kafe/quiz_images");
        question.image = upload.secure_url;
        question.imagePublicId = upload.public_id;
      }
      if (!question.image) {
        throw new Error("Every question needs an image.");
      }
      delete question.imageFile;
      return question;
    })
  );
}

async function validateCourse(courseId) {
  const course = await Course.findById(courseId);
  if (!course) throw new Error("Course not found");
}

async function validateLesson(courseId, lessonId) {
  const [course, lesson] = await Promise.all([Course.findById(courseId), Lesson.findById(lessonId)]);
  if (!course) throw new Error("Course not found");
  if (!lesson || String(lesson.course) !== String(courseId)) throw new Error("Lesson not found in this course");
}

function duplicateQuizMessage(quizType) {
  return quizType === "course"
    ? "A final quiz already exists for this course."
    : "A quiz already exists for this lesson.";
}

const createQuiz = async (req, res) => {
  let finalQuizType = "lesson";
  try {
    const { courseId, lessonId, title, quizType } = req.body;
    finalQuizType = quizType || "lesson"; // Default to lesson for backward compatibility
    const maxAttempts = req.body.maxAttempts === "" || req.body.maxAttempts === undefined ? null : Number(req.body.maxAttempts);
    
    if (!courseId || !title?.trim()) return res.status(400).json({ message: "Course and quiz title are required." });
    if (!["lesson", "course"].includes(finalQuizType)) return res.status(400).json({ message: "Quiz type must be 'lesson' or 'course'." });
    if (finalQuizType === "lesson" && !lessonId) return res.status(400).json({ message: "Lesson is required for lesson-type quizzes." });
    if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) return res.status(400).json({ message: "Attempt limit must be a whole number of at least 1." });
    
    if (finalQuizType === "lesson") {
      await validateLesson(courseId, lessonId);
    } else {
      await validateCourse(courseId);
    }
    
    const questions = await uploadQuestionImages(parseQuestions(req.body.questions, req.files));
    // The current Admin flow predates status controls and has no status input.
    // Publishing here preserves its established Video Course behavior.
    const quizData = { course: courseId, title: title.trim(), maxAttempts, questions, quizType: finalQuizType, status: "published" };
    if (finalQuizType === "lesson") quizData.lesson = lessonId;
    
    const quiz = await Quiz.create(quizData);
    return res.status(201).json(quiz);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: duplicateQuizMessage(finalQuizType) });
    return res.status(error.message.includes("not found") ? 404 : 400).json({ message: error.message });
  }
};

const getAdminQuizzes = async (_req, res) => {
  try {
    const quizzes = await Quiz.find().populate("course", "title").populate("lesson", "title order").sort({ createdAt: -1 });
    return res.json(quizzes);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAdminQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).populate("course", "title").populate("lesson", "title order");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    return res.json(quiz);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateQuiz = async (req, res) => {
  let quizType = "lesson";
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    
    const courseId = req.body.courseId || String(quiz.course);
    const lessonId = req.body.lessonId || String(quiz.lesson);
    quizType = req.body.quizType || quiz.quizType;
    
    if (!["lesson", "course"].includes(quizType)) return res.status(400).json({ message: "Quiz type must be 'lesson' or 'course'." });
    if (quizType === "lesson" && !lessonId) return res.status(400).json({ message: "Lesson is required for lesson-type quizzes." });
    
    if (quizType === "lesson") {
      await validateLesson(courseId, lessonId);
    } else {
      await validateCourse(courseId);
    }
    
    const questions = await uploadQuestionImages(parseQuestions(req.body.questions, req.files));
    quiz.course = courseId;
    quiz.quizType = quizType;
    if (quizType === "lesson") {
      quiz.lesson = lessonId;
    } else {
      quiz.lesson = null;
    }
    quiz.title = req.body.title?.trim() || quiz.title;
    if (req.body.maxAttempts !== undefined) {
      const maxAttempts = req.body.maxAttempts === "" ? null : Number(req.body.maxAttempts);
      if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) return res.status(400).json({ message: "Attempt limit must be a whole number of at least 1." });
      quiz.maxAttempts = maxAttempts;
    }
    quiz.questions = questions;
    await quiz.save();
    return res.json(quiz);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: duplicateQuizMessage(quizType) });
    return res.status(error.message.includes("not found") ? 404 : 400).json({ message: error.message });
  }
};

const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    await QuizAttempt.deleteMany({ quiz: quiz._id });
    return res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getStudentQuizzesForLesson = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ course: req.params.courseId, lesson: req.params.lessonId, contextType: "course_lesson", status: "published" });
    return res.json(await Promise.all(quizzes.map((quiz) => studentQuizProjection({ quiz, user: req.user }))));
  } catch (error) {
    return studentQuizError(res, error);
  }
};

const submitQuiz = async (req, res) => {
  try {
    return res.json(await submitQuizRuntime({
      quizId: req.params.quizId,
      user: req.user,
      submittedRevision: req.body?.revision,
      answers: req.body?.answers,
    }));
  } catch (error) {
    return studentQuizError(res, error);
  }
};

const getQuizAttempts = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).select("title maxAttempts goalPercent contextType course");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const attempts = await QuizAttempt.find({ quiz: quiz._id }).populate("user", "name email").sort({ createdAt: -1 });
    const studentIds = [...new Set(attempts.map((attempt) => String(attempt.user?._id)).filter(Boolean))];
    const [grants, goals] = await Promise.all([
      QuizAttemptGrant.find({ quiz: quiz._id }).select("user").lean(),
      QuizGoalAchievement.find({ quiz: quiz._id }).select("user").lean(),
    ]);
    const extraGrantsByStudent = grants.reduce((result, grant) => ({ ...result, [String(grant.user)]: (result[String(grant.user)] || 0) + 1 }), {});
    const goalReachedStudentIds = goals.map((goal) => String(goal.user));
    return res.json({ quiz, attempts, extraGrantsByStudent, goalReachedStudentIds, studentIds });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const grantQuizAttempt = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).select("contextType course maxAttempts title");
    const studentId = req.body?.studentId;
    const reason = String(req.body?.reason || "").trim();
    if (!quiz || quiz.contextType !== "course_final") return res.status(404).json({ message: "Course final quiz is unavailable." });
    if (!studentId || !require("mongoose").isValidObjectId(studentId)) return res.status(400).json({ message: "Select a valid student." });
    if (reason.length > 300) return res.status(400).json({ message: "Reason must be 300 characters or fewer." });
    const [student, enrollment] = await Promise.all([
      User.findOne({ _id: studentId, role: "user", isActive: true }).select("_id").lean(),
      Enrollment.exists({ userId: studentId, courseId: quiz.course }),
    ]);
    if (!student || !enrollment) return res.status(404).json({ message: "Student is unavailable for this course final." });
    const grant = await QuizAttemptGrant.create({ user: studentId, quiz: quiz._id, grantedBy: req.user.id || req.user._id, reason });
    const [timesTaken, extraGrants, goalReached] = await Promise.all([
      QuizAttempt.countDocuments({ user: studentId, quiz: quiz._id }),
      QuizAttemptGrant.countDocuments({ user: studentId, quiz: quiz._id }),
      QuizGoalAchievement.exists({ user: studentId, quiz: quiz._id }),
    ]);
    await writeAuditLog({ actorId: req.user.id || req.user._id, action: "quiz.attempt_granted", targetType: "QuizAttemptGrant", targetId: grant._id, metadata: { studentId: String(studentId), quizId: String(quiz._id), reason } });
    return res.status(201).json({ grant: { id: grant._id, grantedAt: grant.grantedAt, reason: grant.reason }, timesTaken, extraGrants, effectiveMaxAttempts: quiz.maxAttempts + extraGrants, baseMaxAttempts: quiz.maxAttempts, goalReached: Boolean(goalReached) });
  } catch (error) {
    return res.status(500).json({ message: "Unable to grant an extra submission." });
  }
};

const getStudentQuizHistory = async (req, res) => {
  try {
    return res.json(await studentQuizHistory({ quizId: req.params.quizId, user: req.user }));
  } catch (error) {
    return studentQuizError(res, error);
  }
};

const getStudentCourseQuizzes = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const enrolled = await Enrollment.exists({ userId, courseId: req.params.courseId });
    if (!enrolled && req.user.role !== "admin") throw new Error("QUIZ_UNAVAILABLE");
    const quizzes = await Quiz.find({ course: req.params.courseId, contextType: "course_final", status: "published" });
    const states = await Promise.all(quizzes.map(async (quiz) => {
      const [progress, attempts, extraGrants, goalReached] = await Promise.all([
        courseFinalProgress({ quiz, userId, recover: true }),
        QuizAttempt.find({ quiz: quiz._id, user: userId }).select("score total createdAt").sort({ createdAt: 1 }).lean(),
        QuizAttemptGrant.countDocuments({ quiz: quiz._id, user: userId }),
        QuizGoalAchievement.exists({ quiz: quiz._id, user: userId }),
      ]);
      const summary = {
        locked: progress.locked,
        requiredLessonQuizCount: progress.requiredCount,
        completedLessonQuizCount: progress.completedCount,
        latestScore: attempts.at(-1) ? { score: attempts.at(-1).score, total: attempts.at(-1).total } : null,
        bestScore: attempts.length ? Math.max(...attempts.map((attempt) => attempt.total ? (attempt.score / attempt.total) * 100 : 0)) : null,
        timesTaken: attempts.length,
        extraGrants,
        goalPercent: quiz.goalPercent,
        goalReached: Boolean(goalReached),
      };
      if (progress.locked) return { _id: quiz._id, id: String(quiz._id), title: quiz.title, contextType: quiz.contextType, quizType: quiz.quizType, maxAttempts: quiz.maxAttempts + extraGrants, attemptsUsed: attempts.length, questions: [], ...summary };
      return { ...(await studentQuizProjection({ quiz, user: req.user })), ...summary };
    }));
    return res.json(states);
  } catch (error) {
    if (error.message === "QUIZ_UNAVAILABLE") return res.status(404).json({ message: "Quiz is unavailable." });
    return studentQuizError(res, error);
  }
};

module.exports = { createQuiz, getAdminQuizzes, getAdminQuiz, updateQuiz, deleteQuiz, getStudentQuizzesForLesson, submitQuiz, getQuizAttempts, getStudentQuizHistory, getStudentCourseQuizzes, grantQuizAttempt };
