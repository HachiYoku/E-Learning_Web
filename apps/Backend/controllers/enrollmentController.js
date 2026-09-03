const Enrollment = require("../models/enrollmentModel");
const Lesson = require("../models/lessonModel");
const mongoose = require("mongoose");

const serializeProgress = (enrollment, totalLessons) => {
  const completedLessonIds = (enrollment.completedLessonIds || []).map(String);
  const completedLessons = Math.min(completedLessonIds.length, totalLessons);

  return {
    completedLessonIds,
    completedLessons,
    totalLessons,
    percentage: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    lastOpenedLesson: enrollment.lastOpenedLesson
      ? {
          id: enrollment.lastOpenedLesson._id || enrollment.lastOpenedLesson,
          title: enrollment.lastOpenedLesson.title || "",
          order: enrollment.lastOpenedLesson.order || 0,
        }
      : null,
    lastOpenedAt: enrollment.lastOpenedAt,
  };
};

const getEnrollmentForCourse = (userId, courseId) =>
  Enrollment.findOne({ userId, courseId }).populate("lastOpenedLesson", "title order");

const findCourseLesson = async (courseId, lessonId) => {
  if (!mongoose.isValidObjectId(lessonId)) return null;
  return Lesson.findOne({ _id: lessonId, course: courseId }).select("title order");
};

const getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user.id })
      .populate("courseId", "title description price thumbnail isPublished")
      .populate("paymentId", "status paymentImage")
      .populate("lastOpenedLesson", "title order")
      .sort({ createdAt: -1 });

    const results = await Promise.all(
      enrollments.map(async (enrollment) => {
        const totalLessons = await Lesson.countDocuments({ course: enrollment.courseId?._id || enrollment.courseId });
        return { ...enrollment.toObject(), progress: serializeProgress(enrollment, totalLessons) };
      })
    );

    return res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMyCourseProgress = async (req, res) => {
  try {
    const enrollment = await getEnrollmentForCourse(req.user.id, req.params.courseId);
    if (!enrollment) return res.status(403).json({ message: "You are not enrolled in this course" });

    const totalLessons = await Lesson.countDocuments({ course: req.params.courseId });
    return res.status(200).json(serializeProgress(enrollment, totalLessons));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateLastOpenedLesson = async (req, res) => {
  try {
    const lesson = await findCourseLesson(req.params.courseId, req.body.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found in this course" });

    const enrollment = await getEnrollmentForCourse(req.user.id, req.params.courseId);
    if (!enrollment) return res.status(403).json({ message: "You are not enrolled in this course" });

    enrollment.lastOpenedLesson = lesson._id;
    enrollment.lastOpenedAt = new Date();
    await enrollment.save();

    const totalLessons = await Lesson.countDocuments({ course: req.params.courseId });
    return res.status(200).json(serializeProgress({ ...enrollment.toObject(), lastOpenedLesson: lesson }, totalLessons));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateLessonCompletion = async (req, res) => {
  try {
    const lesson = await findCourseLesson(req.params.courseId, req.body.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found in this course" });

    const enrollment = await getEnrollmentForCourse(req.user.id, req.params.courseId);
    if (!enrollment) return res.status(403).json({ message: "You are not enrolled in this course" });

    const completed = req.body.completed !== false;
    const lessonId = String(lesson._id);
    const completedIds = (enrollment.completedLessonIds || []).map(String);
    enrollment.completedLessonIds = completed
      ? [...new Set([...completedIds, lessonId])]
      : completedIds.filter((id) => id !== lessonId);
    await enrollment.save();

    const totalLessons = await Lesson.countDocuments({ course: req.params.courseId });
    return res.status(200).json(serializeProgress(enrollment, totalLessons));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const checkEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId: req.params.courseId,
    });

    return res.status(200).json({ enrolled: Boolean(enrollment) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMyEnrollments,
  checkEnrollment,
  getMyCourseProgress,
  updateLastOpenedLesson,
  updateLessonCompletion,
};
