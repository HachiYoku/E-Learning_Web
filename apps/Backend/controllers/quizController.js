const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");
const Quiz = require("../models/quizModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizAttemptGrant = require("../models/quizAttemptGrantModel");
const QuizAttemptRequest = require("../models/quizAttemptRequestModel");
const QuizGoalAchievement = require("../models/quizGoalAchievementModel");
const Enrollment = require("../models/enrollmentModel");
const User = require("../models/userModel");
const { writeAuditLog } = require("../services/auditLogger");
const { uploadStream } = require("../services/uploadStream");
const { submitQuiz: submitQuizRuntime, studentQuizHistory, studentQuizProjection, statusForError } = require("../services/quizRuntime");
const { courseFinalProgress } = require("../services/courseFinalProgress");
const { createRequest, listStudentRequests, cancelRequest, reviewRequest, QuizAttemptRequestError } = require("../services/quizAttemptRequestService");
const { createNotification } = require("./notificationController");
const { startQuizSession } = require("../services/quizSessionService");
const QuizSession = require("../models/quizSessionModel");
const { invalidateQuizSessions } = require("../services/quizSessionService");
const QuizMedia = require("../models/quizMediaModel");
const { registerQuizMedia, reconcileReplacedQuizMedia, cleanupQuizMedia } = require("../services/quizMediaLifecycle");
const mongoose = require("mongoose");

function requestError(res, error) {
  if (error instanceof QuizAttemptRequestError || error?.code === "quiz_unavailable") {
    return res.status(error.status || 404).json({ message: error.message });
  }
  console.error("Quiz attempt request failed", { name: error?.name });
  return res.status(500).json({ message: "Unable to process the extra submission request." });
}

async function notifyBestEffort(payload) {
  try { await createNotification(payload); } catch (error) { console.warn("Quiz attempt request notification failed", { name: error?.name }); }
}

function studentQuizError(res, error) {
  const status = statusForError(error);
  if (status !== 500) return res.status(status).json({ message: error.message, code: error.code });
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
    const rawOptions = Array.isArray(question.options)
      ? question.options.map((option) => String(option || "").trim())
      : [];
    const selectedIndex = Number(question.correctAnswer);
    const options = rawOptions.filter(Boolean);
    const correctAnswer = Number.isInteger(selectedIndex) && rawOptions[selectedIndex] ? rawOptions.slice(0, selectedIndex).filter(Boolean).length : -1;
    const imageFile = files.find((file) => file.fieldname === `questionImage_${index}`);
    const audioFile = files.find((file) => file.fieldname === `questionAudio_${index}`);

    if (options.length < 2 || options.length > 6 || !Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      throw new Error(`Question ${index + 1} needs 2–6 options and one correct answer.`);
    }

    return {
      _id: mongoose.isValidObjectId(question._id) ? question._id : new mongoose.Types.ObjectId(),
      prompt: String(question.prompt || "").trim(),
      image: String(question.image || "").trim(),
      imagePublicId: question.imagePublicId,
      imageResourceType: question.imageResourceType || "image",
      imageFormat: question.imageFormat || "",
      imageAlt: String(question.imageAlt || "").trim(),
      imageDecorative: String(question.imageDecorative) === "true" || question.imageDecorative === true,
      audio: String(question.audio || "").trim(),
      audioPublicId: question.audioPublicId,
      audioResourceType: question.audioResourceType || "video",
      audioFormat: question.audioFormat || "",
      audioLabel: String(question.audioLabel || "").trim(),
      options,
      correctAnswer,
      imageFile,
      audioFile,
    };
  });
}

async function uploadQuestionMedia(questions, quizId, uploadedMedia) {
  for (const question of questions) {
    for (const mediaType of ["image", "audio"]) {
      const file = question[`${mediaType}File`];
      if (!file) continue;
      const resourceType = mediaType === "image" ? "image" : "video";
      const upload = await uploadStream(file.buffer, `arun_thai/quiz_media/${mediaType === "image" ? "images" : "audio"}`, { resource_type: resourceType });
      const data = { quiz: quizId, questionId: question._id, mediaType, publicId: upload.public_id, resourceType: upload.resource_type || resourceType, url: upload.secure_url, format: upload.format || "", cleanupState: "pending_cleanup" };
      // Keep ownership/recovery information before attempting Quiz persistence.
      uploadedMedia.push(data);
      const record = await QuizMedia.create(data);
      data._id = record._id;
      question[mediaType] = data.url;
      question[`${mediaType}PublicId`] = data.publicId;
      question[`${mediaType}ResourceType`] = data.resourceType;
      question[`${mediaType}Format`] = data.format;
    }
    delete question.imageFile;
    delete question.audioFile;
  }
  return questions;
}

async function rollbackUploads(uploadedMedia) {
  for (const data of uploadedMedia) {
    // If ownership registration itself failed, try to durably record it before
    // cleanup. Cleanup errors are retained for a later recovery attempt.
    const record = data._id ? data : await QuizMedia.findOneAndUpdate({ publicId: data.publicId }, { $setOnInsert: data }, { upsert: true, returnDocument: "after" });
    await cleanupQuizMedia(record);
  }
}

function preserveOwnedMedia(question, previous) {
  for (const type of ["image", "audio"]) {
    if (!question[`${type}File`] && question[type] && question[type] !== (previous?.[type] || "")) throw new Error("Use the upload control to replace question media.");
    question[`${type}PublicId`] = question[type] && !question[`${type}File`] ? previous?.[`${type}PublicId`] : "";
    question[`${type}ResourceType`] = previous?.[`${type}ResourceType`] || (type === "image" ? "image" : "video");
    question[`${type}Format`] = previous?.[`${type}Format`] || "";
  }
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

function scoringMeaningChanged(previousQuestions, nextQuestions) {
  const before = (previousQuestions || []).map((question) => ({ options: question.options || [], correctAnswer: Number(question.correctAnswer) }));
  const after = (nextQuestions || []).map((question) => ({ options: question.options || [], correctAnswer: Number(question.correctAnswer) }));
  return JSON.stringify(before) !== JSON.stringify(after);
}

function questionMeaning(question) {
  return {
    _id: String(question._id || ""),
    prompt: String(question.prompt || ""),
    image: question.imageFile ? "__replacement__" : String(question.image || ""),
    imageAlt: String(question.imageAlt || ""),
    imageDecorative: Boolean(question.imageDecorative),
    audio: question.audioFile ? "__replacement__" : String(question.audio || ""),
    audioLabel: String(question.audioLabel || ""),
    options: (question.options || []).map(String),
    correctAnswer: Number(question.correctAnswer),
  };
}

const createQuiz = async (req, res) => {
  const uploadedMedia = [];
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
    
    const quizId = new mongoose.Types.ObjectId();
    const questions = await uploadQuestionMedia(parseQuestions(req.body.questions, req.files), quizId, uploadedMedia);
    // Creation saves a Draft; publishing is a separate Admin action.
    const quizData = { _id: quizId, course: courseId, title: title.trim(), maxAttempts, questions, quizType: finalQuizType, status: "draft" };
    if (finalQuizType === "lesson") quizData.lesson = lessonId;
    
    const quiz = await Quiz.create(quizData);
    await registerQuizMedia(quiz);
    return res.status(201).json(quiz);
  } catch (error) {
    await rollbackUploads(uploadedMedia);
    if (error.code === 11000) return res.status(400).json({ message: duplicateQuizMessage(finalQuizType) });
    return res.status(error.message.includes("not found") ? 404 : 400).json({ message: error.message });
  }
};

const getAdminQuizzes = async (_req, res) => {
  try {
    const quizzes = await Quiz.find().populate("course", "title").populate("lesson", "title order").sort({ createdAt: -1 });
    const withHistory = await Promise.all(quizzes.map(async (quiz) => ({
      ...quiz.toObject(),
      attemptCount: await QuizAttempt.countDocuments({ quiz: quiz._id }),
    })));
    return res.json(withHistory);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAdminQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).populate("course", "title").populate("lesson", "title order");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const activeSessionCount = await QuizSession.countDocuments({ quiz: quiz._id, expiresAt: { $gt: new Date() }, invalidatedAt: null });
    return res.json({ ...quiz.toObject(), activeSessionCount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateQuiz = async (req, res) => {
  const uploadedMedia = [];
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
    
    const previousQuiz = quiz.toObject();
    const questions = parseQuestions(req.body.questions, req.files);
    const rawQuestions = typeof req.body.questions === "string" ? JSON.parse(req.body.questions) : req.body.questions;
    questions.forEach((question, index) => { if (!rawQuestions[index]._id && previousQuiz.questions[index]) question._id = previousQuiz.questions[index]._id; });
    for (const question of questions) preserveOwnedMedia(question, previousQuiz.questions.find((item) => String(item._id) === String(question._id)));
    const hasHistory = await QuizAttempt.exists({ quiz: quiz._id });
    if (hasHistory && String(req.body.confirmHistoryChange) !== "true" && JSON.stringify(previousQuiz.questions.map(questionMeaning)) !== JSON.stringify(questions.map(questionMeaning))) {
      return res.status(409).json({ code: "question_history_requires_confirmation", message: "Changes apply to new Quiz sessions only. Previous student results retain their original question content." });
    }
    const scoringChange = scoringMeaningChanged(previousQuiz.questions, questions);
    const activeSessionCount = scoringChange ? await QuizSession.countDocuments({ quiz: quiz._id, expiresAt: { $gt: new Date() }, invalidatedAt: null }) : 0;
    if (scoringChange && activeSessionCount > 0 && String(req.body.confirmScoringChange) !== "true") {
      return res.status(409).json({ message: "Students currently have this quiz open. Confirm the scoring change to require them to restart.", code: "active_sessions_require_confirmation", activeSessionCount });
    }
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
    quiz.questions = await uploadQuestionMedia(questions, quiz._id, uploadedMedia);
    await quiz.save();
    await registerQuizMedia(quiz);
    await reconcileReplacedQuizMedia(previousQuiz, quiz);
    if (scoringChange) await invalidateQuizSessions({ quizId: quiz._id, reason: "scoring_change" });
    return res.json(quiz);
  } catch (error) {
    await rollbackUploads(uploadedMedia);
    if (error.code === 11000) return res.status(400).json({ message: duplicateQuizMessage(quizType) });
    return res.status(error.message.includes("not found") ? 404 : 400).json({ message: error.message });
  }
};

const updateQuizQuestion = async (req, res) => {
  const uploadedMedia = [];
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const questionIndex = quiz.questions.findIndex((question) => String(question._id) === String(req.params.questionId));
    if (questionIndex < 0) return res.status(404).json({ message: "Question not found" });
    const previousQuiz = quiz.toObject();
    let rawQuestion = req.body.question || req.body;
    if (typeof rawQuestion === "string") rawQuestion = JSON.parse(rawQuestion);
    const [candidateQuestion] = parseQuestions([rawQuestion], req.files);
    const previousQuestion = previousQuiz.questions[questionIndex];
    candidateQuestion._id = previousQuestion._id;
    preserveOwnedMedia(candidateQuestion, previousQuestion);
    // Validate before sending media to the provider. Temporary URLs stand in
    // only for files that have already passed upload validation middleware.
    const preflight = new Quiz({ ...previousQuiz, questions: [{ ...candidateQuestion, image: candidateQuestion.imageFile ? "pending-upload" : candidateQuestion.image, audio: candidateQuestion.audioFile ? "pending-upload" : candidateQuestion.audio }] });
    await preflight.validate();
    const hasHistory = await QuizAttempt.exists({ quiz: quiz._id, "submissionSnapshot.questions.questionId": previousQuestion._id });
    const meaningfulChange = JSON.stringify(questionMeaning(previousQuestion)) !== JSON.stringify(questionMeaning(candidateQuestion));
    if (hasHistory && meaningfulChange && String(req.body.confirmHistoryChange) !== "true") {
      return res.status(409).json({ code: "question_history_requires_confirmation", message: "Students have already answered this question. Your change will apply to new Quiz sessions only. Previous results will keep the original question content." });
    }
    const scoringChange = JSON.stringify({ options: previousQuestion.options, correctAnswer: Number(previousQuestion.correctAnswer) }) !== JSON.stringify({ options: candidateQuestion.options, correctAnswer: Number(candidateQuestion.correctAnswer) });
    const activeSessionCount = scoringChange ? await QuizSession.countDocuments({ quiz: quiz._id, expiresAt: { $gt: new Date() }, invalidatedAt: null }) : 0;
    if (scoringChange && activeSessionCount && String(req.body.confirmScoringChange) !== "true") {
      return res.status(409).json({ code: "active_sessions_require_confirmation", activeSessionCount, message: "Students currently have this quiz open. Confirm the scoring change to require them to restart." });
    }
    const [nextQuestion] = await uploadQuestionMedia([candidateQuestion], quiz._id, uploadedMedia);
    quiz.questions[questionIndex] = { ...nextQuestion, _id: previousQuestion._id };
    await quiz.save();
    await registerQuizMedia(quiz);
    await reconcileReplacedQuizMedia(previousQuiz, quiz);
    if (scoringChange) await invalidateQuizSessions({ quizId: quiz._id, reason: "scoring_change" });
    return res.json({ question: quiz.questions[questionIndex], revision: quiz.revision });
  } catch (error) {
    await rollbackUploads(uploadedMedia);
    return res.status(400).json({ message: error.name === "ValidationError" || error instanceof SyntaxError ? "Check the question content, answer choices and correct answer, then retry." : "Unable to save this question. Please retry." });
  }
};

const createQuizQuestion = async (req, res) => {
  const uploadedMedia = [];
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    let rawQuestion = req.body.question || req.body;
    if (typeof rawQuestion === "string") rawQuestion = JSON.parse(rawQuestion);
    const [candidate] = parseQuestions([rawQuestion], req.files);
    // The new-question endpoint must not accept an existing question identity.
    candidate._id = new mongoose.Types.ObjectId();
    // A new question is never allowed to claim an existing external asset.
    preserveOwnedMedia(candidate, null);
    const previousQuiz = quiz.toObject();
    await new Quiz({ ...previousQuiz, questions: [...previousQuiz.questions, {
      ...candidate,
      image: candidate.imageFile ? "pending-upload" : candidate.image,
      audio: candidate.audioFile ? "pending-upload" : candidate.audio,
    }] }).validate();
    if (await QuizAttempt.exists({ quiz: quiz._id }) && String(req.body.confirmHistoryChange) !== "true") {
      return res.status(409).json({ code: "question_history_requires_confirmation", message: "This change applies to new Quiz sessions only. Previous student results keep their original questions." });
    }
    const activeSessionCount = await QuizSession.countDocuments({ quiz: quiz._id, expiresAt: { $gt: new Date() }, invalidatedAt: null });
    if (activeSessionCount && String(req.body.confirmScoringChange) !== "true") {
      return res.status(409).json({ code: "active_sessions_require_confirmation", activeSessionCount, message: "Students currently taking this Quiz will need to restart after the new question is saved." });
    }
    const [question] = await uploadQuestionMedia([candidate], quiz._id, uploadedMedia);
    quiz.questions.push(question);
    await quiz.save();
    await registerQuizMedia(quiz);
    if (activeSessionCount) await invalidateQuizSessions({ quizId: quiz._id, reason: "scoring_change" });
    return res.status(201).json({ question: quiz.questions.at(-1), revision: quiz.revision });
  } catch (error) {
    await rollbackUploads(uploadedMedia);
    return res.status(400).json({ message: error.name === "ValidationError" || error instanceof SyntaxError ? "Check the question content, answer choices and correct answer, then retry." : "Unable to save this question. Please retry." });
  }
};

const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const attemptCount = await QuizAttempt.countDocuments({ quiz: quiz._id });
    if (attemptCount > 0) {
      return res.status(409).json({
        code: "quiz_has_history",
        message: "This quiz has student results and cannot be permanently deleted. Archive it instead to preserve student history.",
      });
    }
    await invalidateQuizSessions({ quizId: quiz._id, reason: "deleted" });
    await Quiz.deleteOne({ _id: quiz._id });
    const media = await QuizMedia.find({ quiz: quiz._id, cleanupState: { $ne: "deleted" } });
    await Promise.all(media.map(cleanupQuizMedia));
    return res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const archiveQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    quiz.status = "archived";
    await quiz.save();
    await invalidateQuizSessions({ quizId: quiz._id, reason: "archived" });
    return res.json({ archived: true, message: "Quiz archived. Student history has been preserved.", quiz });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const restoreQuiz = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(404).json({ message: "Quiz not found" });
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.quizId, status: "archived" },
      { $set: { status: "disabled" }, $inc: { revision: 1 } },
      { returnDocument: "after", runValidators: true }
    );
    if (!quiz) {
      if (!(await Quiz.exists({ _id: req.params.quizId }))) return res.status(404).json({ message: "Quiz not found" });
      return res.status(409).json({ message: "Only an archived quiz can be restored." });
    }
    return res.json({ message: "Quiz restored as disabled. Publish it separately to make it available to students.", quiz });
  } catch (error) {
    return res.status(500).json({ message: "Unable to restore this quiz." });
  }
};

const changeQuizAvailability = async (req, res) => {
  const nextStatus = req.body?.status;
  if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(404).json({ message: "Quiz not found" });
  const allowedPrevious = nextStatus === "disabled" ? ["published"] : nextStatus === "published" ? ["draft", "disabled"] : null;
  if (!allowedPrevious) return res.status(400).json({ message: "Choose Publish Quiz or Disable Quiz." });
  try {
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.quizId, status: { $in: allowedPrevious } },
      { $set: { status: nextStatus }, $inc: { revision: 1 } },
      { returnDocument: "after", runValidators: true }
    );
    if (!quiz) {
      if (!(await Quiz.exists({ _id: req.params.quizId }))) return res.status(404).json({ message: "Quiz not found" });
      return res.status(409).json({ message: "This quiz cannot make that status change." });
    }
    if (nextStatus === "disabled") await invalidateQuizSessions({ quizId: quiz._id, reason: "disabled" });
    return res.json({ quiz });
  } catch (error) {
    console.error("Quiz availability change failed", { name: error?.name });
    return res.status(500).json({ message: "Unable to change quiz availability." });
  }
};

const getStudentQuizzesForLesson = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ course: req.params.courseId, lesson: req.params.lessonId, contextType: "course_lesson", status: "published" }).populate("course", "title").populate("lesson", "title order");
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
      sessionId: req.body?.sessionId,
      answers: req.body?.answers,
    }));
  } catch (error) {
    return studentQuizError(res, error);
  }
};

const startStudentQuizSession = async (req, res) => {
  try {
    return res.status(201).json(await startQuizSession({ quizId: req.params.quizId, user: req.user }));
  } catch (error) {
    return studentQuizError(res, error);
  }
};

const getQuizAttempts = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).select("title maxAttempts goalPercent contextType course");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const attempts = await QuizAttempt.find({ quiz: quiz._id }).populate("user", "name email").sort({ createdAt: -1 });
    const [grants, goals, requests] = await Promise.all([
      QuizAttemptGrant.find({ quiz: quiz._id }).select("user source reason grantedAt request").lean(),
      QuizGoalAchievement.find({ quiz: quiz._id }).select("user").lean(),
      QuizAttemptRequest.find({ quiz: quiz._id }).populate("user", "name email").populate("reviewedBy", "name").sort({ createdAt: -1 }).lean(),
    ]);
    const studentIds = [...new Set([...attempts.map((attempt) => String(attempt.user?._id)), ...requests.map((request) => String(request.user?._id))].filter(Boolean))];
    const extraGrantsByStudent = grants.reduce((result, grant) => ({ ...result, [String(grant.user)]: (result[String(grant.user)] || 0) + 1 }), {});
    const goalReachedStudentIds = goals.map((goal) => String(goal.user));
    return res.json({ quiz, attempts, grants, requests, extraGrantsByStudent, goalReachedStudentIds, studentIds });
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
    if (!Number.isInteger(quiz.maxAttempts) || quiz.maxAttempts < 1) return res.status(400).json({ message: "Extra submissions are only available for limited Course Finals." });
    if (!studentId || !require("mongoose").isValidObjectId(studentId)) return res.status(400).json({ message: "Select a valid student." });
    if (reason.length > 300) return res.status(400).json({ message: "Reason must be 300 characters or fewer." });
    const [student, enrollment] = await Promise.all([
      User.findOne({ _id: studentId, role: "user", isActive: true }).select("_id").lean(),
      Enrollment.exists({ userId: studentId, courseId: quiz.course }),
    ]);
    if (!student || !enrollment) return res.status(404).json({ message: "Student is unavailable for this course final." });
    const grant = await QuizAttemptGrant.create({ user: studentId, quiz: quiz._id, grantedBy: req.user.id || req.user._id, reason, source: "direct_admin" });
    const [timesTaken, extraGrants, goalReached] = await Promise.all([
      QuizAttempt.countDocuments({ user: studentId, quiz: quiz._id }),
      QuizAttemptGrant.countDocuments({ user: studentId, quiz: quiz._id }),
      QuizGoalAchievement.exists({ user: studentId, quiz: quiz._id }),
    ]);
    await writeAuditLog({ actorId: req.user.id || req.user._id, action: "quiz.attempt_granted", targetType: "QuizAttemptGrant", targetId: grant._id, metadata: { studentId: String(studentId), quizId: String(quiz._id), reason } });
    return res.status(201).json({ grant: { id: grant._id, grantedAt: grant.grantedAt, reason: grant.reason, source: grant.source }, timesTaken, extraGrants, effectiveMaxAttempts: quiz.maxAttempts + extraGrants, baseMaxAttempts: quiz.maxAttempts, goalReached: Boolean(goalReached) });
  } catch (error) {
    return res.status(500).json({ message: "Unable to grant an extra submission." });
  }
};

const createStudentAttemptRequest = async (req, res) => {
  try {
    const result = await createRequest({ quizId: req.params.quizId, user: req.user, reason: req.body?.reason });
    await writeAuditLog({ actorId: req.user.id || req.user._id, action: "quiz.attempt_request_created", targetType: "QuizAttemptRequest", targetId: result.request._id, metadata: { quizId: String(result.quiz._id) } });
    const admins = await User.find({ role: "admin", isActive: true }).select("_id").lean();
    await Promise.all(admins.map((admin) => notifyBestEffort({ userId: admin._id, courseId: result.quiz.course, type: "info", title: "New extra quiz submission request", message: `A student requested an additional submission for “${result.quiz.title}”.` })));
    return res.status(201).json({ request: result.request, allowance: result.state });
  } catch (error) { return requestError(res, error); }
};

const getStudentAttemptRequests = async (req, res) => {
  try { return res.json({ requests: await listStudentRequests({ quizId: req.params.quizId, user: req.user }) }); }
  catch (error) { return requestError(res, error); }
};

const cancelStudentAttemptRequest = async (req, res) => {
  try {
    const request = await cancelRequest({ quizId: req.params.quizId, requestId: req.params.requestId, user: req.user });
    await writeAuditLog({ actorId: req.user.id || req.user._id, action: "quiz.attempt_request_cancelled", targetType: "QuizAttemptRequest", targetId: request._id, metadata: { quizId: String(req.params.quizId) } });
    return res.json({ request });
  } catch (error) { return requestError(res, error); }
};

const reviewStudentAttemptRequest = async (req, res) => {
  try {
    const result = await reviewRequest({ quizId: req.params.quizId, requestId: req.params.requestId, adminId: req.user.id || req.user._id, decision: req.body?.decision, note: req.body?.note });
    const action = result.decision === "approved" ? "quiz.attempt_request_approved" : result.decision === "rejected" ? "quiz.attempt_request_rejected" : "quiz.attempt_request_superseded";
    await writeAuditLog({ actorId: req.user.id || req.user._id, action, targetType: "QuizAttemptRequest", targetId: result.request._id, metadata: { quizId: String(result.quiz._id), studentId: String(result.request.user), grantId: result.grant ? String(result.grant._id) : undefined } });
    if (result.decision === "approved") await notifyBestEffort({ userId: result.request.user, courseId: result.quiz.course, type: "info", title: "Extra quiz submission approved", message: `Your request for an additional submission for “${result.quiz.title}” was approved.`, link: `/app/course-quiz/${result.quiz.course}/${result.quiz._id}` });
    if (result.decision === "rejected") await notifyBestEffort({ userId: result.request.user, courseId: result.quiz.course, type: "info", title: "Extra quiz submission request declined", message: `Your request for “${result.quiz.title}” was not approved.`, link: `/app/course-quiz/${result.quiz.course}/${result.quiz._id}` });
    return res.json({ request: result.request, decision: result.decision, allowance: result.state });
  } catch (error) { return requestError(res, error); }
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
    const quizzes = await Quiz.find({ course: req.params.courseId, contextType: "course_final", status: "published" }).populate("course", "title").populate("lesson", "title order");
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

module.exports = { createQuiz, getAdminQuizzes, getAdminQuiz, updateQuiz, updateQuizQuestion, createQuizQuestion, deleteQuiz, archiveQuiz, restoreQuiz, changeQuizAvailability, getStudentQuizzesForLesson, submitQuiz, startStudentQuizSession, getQuizAttempts, getStudentQuizHistory, getStudentCourseQuizzes, grantQuizAttempt, createStudentAttemptRequest, getStudentAttemptRequests, cancelStudentAttemptRequest, reviewStudentAttemptRequest };
