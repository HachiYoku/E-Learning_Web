const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const {
  getMyEnrollments,
  checkEnrollment,
  getMyCourseProgress,
  updateLastOpenedLesson,
  updateLessonCompletion,
} = require("../controllers/enrollmentController");

const router = express.Router();

router.get("/my", validateToken, getMyEnrollments);
router.get("/check/:courseId", validateToken, checkEnrollment);
router.get("/course/:courseId/progress", validateToken, getMyCourseProgress);
router.put("/course/:courseId/progress/last-opened", validateToken, updateLastOpenedLesson);
router.put("/course/:courseId/progress/completion", validateToken, updateLessonCompletion);

module.exports = router;
