const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");
const Quiz = require("../models/quizModel");
const Enrollment = require("../models/enrollmentModel");
const QuizAttempt = require("../models/quizAttemptModel");
const { uploadStream } = require("../services/uploadStream");

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

const createQuiz = async (req, res) => {
  try {
    const { courseId, lessonId, title, quizType } = req.body;
    const finalQuizType = quizType || "lesson"; // Default to lesson for backward compatibility
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
    const quizData = { course: courseId, title: title.trim(), maxAttempts, questions, quizType: finalQuizType };
    if (finalQuizType === "lesson") quizData.lesson = lessonId;
    
    const quiz = await Quiz.create(quizData);
    return res.status(201).json(quiz);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "A quiz with this title already exists for this course/lesson." });
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
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    
    const courseId = req.body.courseId || String(quiz.course);
    const lessonId = req.body.lessonId || String(quiz.lesson);
    const quizType = req.body.quizType || quiz.quizType;
    
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
    if (error.code === 11000) return res.status(400).json({ message: "A quiz with this title already exists for this course/lesson." });
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
    const quizzes = await Quiz.find({ course: req.params.courseId, lesson: req.params.lessonId }).select("title maxAttempts questions.prompt questions.image questions.options");
    const withAttemptInfo = await Promise.all(quizzes.map(async (quiz) => ({
      ...quiz.toObject(),
      attemptsUsed: await QuizAttempt.countDocuments({ quiz: quiz._id, user: req.user.id }),
    })));
    return res.json(withAttemptInfo);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (req.user.role !== "admin") {
      const enrollment = await Enrollment.exists({ userId: req.user.id, courseId: quiz.course });
      if (!enrollment) return res.status(403).json({ message: "You are not enrolled in this course" });
    }
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    if (answers.length !== quiz.questions.length || quiz.questions.some((question, index) => {
      const answer = Number(answers[index]);
      return !Number.isInteger(answer) || answer < 0 || answer >= question.options.length;
    })) {
      return res.status(400).json({ message: "Submit one valid answer for every question." });
    }
    const results = quiz.questions.map((question, index) => ({ correct: Number(answers[index]) === question.correctAnswer, correctAnswer: question.correctAnswer }));
    const score = results.filter((result) => result.correct).length;
    let attempt;
    let attemptsUsed;

    for (let retry = 0; retry < 5; retry += 1) {
      attemptsUsed = await QuizAttempt.countDocuments({ quiz: quiz._id, user: req.user.id });
      if (quiz.maxAttempts && attemptsUsed >= quiz.maxAttempts) {
        return res.status(403).json({ message: "You have used all available attempts for this quiz." });
      }

      try {
        attempt = await QuizAttempt.create({
          quiz: quiz._id,
          user: req.user.id,
          attemptNumber: attemptsUsed + 1,
          score,
          total: quiz.questions.length,
        });
        break;
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    if (!attempt) return res.status(409).json({ message: "Please try submitting the quiz again." });
    return res.json({ score, total: quiz.questions.length, results, attemptId: attempt._id, attemptsUsed: attemptsUsed + 1, maxAttempts: quiz.maxAttempts });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getQuizAttempts = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).select("title maxAttempts");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const attempts = await QuizAttempt.find({ quiz: quiz._id }).populate("user", "name email").sort({ createdAt: -1 });
    return res.json({ quiz, attempts });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getStudentCourseQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ course: req.params.courseId, quizType: "course" }).select("title maxAttempts questions.prompt questions.image questions.options");
    const withAttemptInfo = await Promise.all(quizzes.map(async (quiz) => ({
      ...quiz.toObject(),
      attemptsUsed: await QuizAttempt.countDocuments({ quiz: quiz._id, user: req.user.id }),
    })));
    return res.json(withAttemptInfo);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { createQuiz, getAdminQuizzes, getAdminQuiz, updateQuiz, deleteQuiz, getStudentQuizzesForLesson, submitQuiz, getQuizAttempts, getStudentCourseQuizzes };
