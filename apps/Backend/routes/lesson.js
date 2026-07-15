const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const requireEnrollment = require("../middleware/enrollmentMiddleware");
const {
  createLesson,
  getLessonsByCourse,
  updateLesson,
  deleteLesson,
} = require("../controllers/lessonController");

const router = express.Router();

router.get("/course/:courseId", validateToken, requireEnrollment, getLessonsByCourse);
router.post("/course/:courseId", validateToken, requireAdmin, createLesson);
router.put("/:lessonId", validateToken, requireAdmin, updateLesson);
router.delete("/:lessonId", validateToken, requireAdmin, deleteLesson);

module.exports = router;
