const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
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
router.post("/admin/:quizId/attempt-grants", validateToken, requireAdmin, controller.grantQuizAttempt);
router.post("/admin/:quizId/attempt-requests/:requestId/review", validateToken, requireAdmin, controller.reviewStudentAttemptRequest);
router.post("/admin", validateToken, requireAdmin, upload.any(), validateImageFileContent, validateQuizImageFields, controller.createQuiz);
router.put("/admin/:quizId", validateToken, requireAdmin, upload.any(), validateImageFileContent, validateQuizImageFields, controller.updateQuiz);
router.delete("/admin/:quizId", validateToken, requireAdmin, controller.deleteQuiz);
router.get("/course/:courseId/lesson/:lessonId", validateToken, controller.getStudentQuizzesForLesson);
router.get("/course/:courseId", validateToken, controller.getStudentCourseQuizzes);
router.get("/:quizId/history", validateToken, controller.getStudentQuizHistory);
router.get("/:quizId/attempt-requests", validateToken, controller.getStudentAttemptRequests);
router.post("/:quizId/attempt-requests", validateToken, controller.createStudentAttemptRequest);
router.patch("/:quizId/attempt-requests/:requestId/cancel", validateToken, controller.cancelStudentAttemptRequest);
router.post("/:quizId/submit", validateToken, controller.submitQuiz);

module.exports = router;
