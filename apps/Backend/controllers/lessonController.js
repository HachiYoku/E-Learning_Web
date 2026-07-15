const Course = require("../models/courseModel");
const Lesson = require("../models/lessonModel");

const createLesson = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, videoUrl, order } = req.body;

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
    });

    return res.status(201).json(lesson);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Lesson order must be unique within the same course",
      });
    }

    return res.status(500).json({ message: error.message });
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

    return res.status(200).json(lessons);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, videoUrl, order } = req.body;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    if (title !== undefined) lesson.title = title;
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
    if (order !== undefined) lesson.order = order;

    await lesson.save();

    return res.status(200).json(lesson);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Lesson order must be unique within the same course",
      });
    }

    return res.status(500).json({ message: error.message });
  }
};

const deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findByIdAndDelete(lessonId);

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

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
