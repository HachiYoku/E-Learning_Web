const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");
const Enrollment = require("../models/enrollmentModel");
const { createNotification } = require("./notificationController");

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

function vocabularyValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeKeyVocabulary(body) {
  if (!hasOwn(body, "keyVocabulary")) return { provided: false };
  const entries = body.keyVocabulary;

  if (!Array.isArray(entries)) throw vocabularyValidationError("keyVocabulary must be an array.");
  if (entries.length > 50) throw vocabularyValidationError("A lesson can have at most 50 key vocabulary entries.");

  return {
    provided: true,
    entries: entries.map((entry, index) => {
      const label = `Key vocabulary entry ${index + 1}`;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw vocabularyValidationError(`${label} must be an object.`);
      }
      if (typeof entry.thai !== "string") throw vocabularyValidationError(`${label} thai must be a string.`);
      if (typeof entry.translation !== "string") throw vocabularyValidationError(`${label} translation must be a string.`);
      if (entry.transliteration !== undefined && typeof entry.transliteration !== "string") {
        throw vocabularyValidationError(`${label} transliteration must be a string.`);
      }

      const thai = entry.thai.trim();
      const translation = entry.translation.trim();
      const transliteration = (entry.transliteration || "").trim();
      if (!thai) throw vocabularyValidationError(`${label} thai is required.`);
      if (!translation) throw vocabularyValidationError(`${label} translation is required.`);
      if (thai.length > 120) throw vocabularyValidationError(`${label} thai must be at most 120 characters.`);
      if (translation.length > 160) throw vocabularyValidationError(`${label} translation must be at most 160 characters.`);
      if (transliteration.length > 160) throw vocabularyValidationError(`${label} transliteration must be at most 160 characters.`);

      return { thai, translation, transliteration };
    }),
  };
}

const createLesson = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, videoUrl, order } = req.body;
    const keyVocabulary = normalizeKeyVocabulary(req.body);

    if (!title || !videoUrl || order === undefined) {
      return res.status(400).json({
        message: "Title, videoUrl, and order are required",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const lesson = await Lesson.create({
      course: courseId,
      title,
      videoUrl,
      order,
      ...(keyVocabulary.provided ? { keyVocabulary: keyVocabulary.entries } : {}),
    });

    const enrollments = await Enrollment.find({ courseId }).select("userId");

    if (enrollments.length > 0) {
      const notifications = enrollments.map(({ userId }) => ({
        userId,
        type: "course",
        title: "New lesson added",
        message: `A new lesson, "${lesson.title}", has been added to ${course.title}.`,
        link: `/course-lessons/${courseId}`,
      }));

      await Promise.all(
        notifications.map((payload) => createNotification(payload))
      );
    }

    return res.status(201).json(lesson);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Lesson order must be unique within the same course",
      });
    }

    return res.status(error.status || 500).json({ message: error.message });
  }
};

const getLessonsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const lessons = await Lesson.find({ course: courseId }).sort({ order: 1 });

    return res.status(200).json(lessons.map((lesson) => {
      const response = lesson.toObject();
      return { ...response, keyVocabulary: Array.isArray(response.keyVocabulary) ? response.keyVocabulary : [] };
    }));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, videoUrl, order } = req.body;
    const keyVocabulary = normalizeKeyVocabulary(req.body);

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    if (title !== undefined) lesson.title = title;
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
    if (order !== undefined) lesson.order = order;
    if (keyVocabulary.provided) lesson.keyVocabulary = keyVocabulary.entries;

    await lesson.save();

    return res.status(200).json(lesson);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Lesson order must be unique within the same course",
      });
    }

    return res.status(error.status || 500).json({ message: error.message });
  }
};

const deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findByIdAndDelete(lessonId);

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    await Enrollment.updateMany(
      { courseId: lesson.course },
      { $pull: { completedLessonIds: lesson._id } }
    );
    await Enrollment.updateMany(
      { courseId: lesson.course, lastOpenedLesson: lesson._id },
      { $unset: { lastOpenedLesson: 1, lastOpenedAt: 1 } }
    );

    return res.status(200).json({ message: "Lesson deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createLesson,
  getLessonsByCourse,
  updateLesson,
  deleteLesson,
};
