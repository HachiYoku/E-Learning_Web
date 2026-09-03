const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const requireEnrollment = require("../middleware/enrollmentMiddleware");
const { createImageUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const controller = require("../controllers/quizController");

const router = express.Router();
const upload = createImageUpload({ maxFiles: 10 });

function validateQuizImageFields(req, res, next) {
  const invalidFile = (req.files || []).find(
    (file) => !/^questionImage_\d+$/.test(file.fieldname)
  );

  if (invalidFile) {
    return res.status(400).json({ message: "Invalid quiz image field." });
  }

  return next();
}

router.get("/admin", validateToken, requireAdmin, controller.getAdminQuizzes);
router.get("/admin/:quizId", validateToken, requireAdmin, controller.getAdminQuiz);
router.get("/admin/:quizId/attempts", validateToken, requireAdmin, controller.getQuizAttempts);
router.post("/admin", validateToken, requireAdmin, upload.any(), validateImageFileContent, validateQuizImageFields, controller.createQuiz);
router.put("/admin/:quizId", validateToken, requireAdmin, upload.any(), validateImageFileContent, validateQuizImageFields, controller.updateQuiz);
router.delete("/admin/:quizId", validateToken, requireAdmin, controller.deleteQuiz);
router.get("/course/:courseId/lesson/:lessonId", validateToken, requireEnrollment, controller.getStudentQuizzesForLesson);
router.get("/course/:courseId", validateToken, requireEnrollment, controller.getStudentCourseQuizzes);
router.get("/:quizId/history", validateToken, controller.getStudentQuizHistory);
router.post("/:quizId/submit", validateToken, controller.submitQuiz);

module.exports = router;
