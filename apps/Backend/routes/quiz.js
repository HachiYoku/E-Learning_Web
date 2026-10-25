const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const { createQuizMediaUpload, validateQuizMediaContent } = require("../middleware/uploadValidation");
const { createQuizSetCoverUpload, validateImageFileContent } = require("../middleware/uploadValidation");
const { rateLimit } = require("express-rate-limit");
const controller = require("../controllers/quizController");
const standalone = require("../controllers/standaloneQuizController");
const standaloneSets = require("../controllers/standaloneQuizSetController");
const { standaloneQuizRateLimit } = require("../middleware/standaloneQuizRateLimit");
const { requireStandaloneRuntimeReady } = require("../services/standaloneQuizRuntimeReadiness");

const router = express.Router();
const upload = createQuizMediaUpload({ maxFiles: 20 });
const coverUpload = createQuizSetCoverUpload();
const coverUploadLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.user.id),
  handler: (_req, res) => res.status(429).json({ message: "Too many cover uploads. Try again later." }),
});

router.get("/standalone/sets", validateToken, standaloneSets.listPublic);
router.get("/standalone/sets/:setId", validateToken, standaloneSets.getPublic);
router.get("/standalone", validateToken, standalone.listPublished);
router.get("/standalone/attempts/:attemptId", validateToken, requireStandaloneRuntimeReady, standalone.getResult);
router.get("/standalone/:quizId/attempts", validateToken, requireStandaloneRuntimeReady, standalone.getHistory);
router.post("/standalone/:quizId/sessions", validateToken, standaloneQuizRateLimit("start"),
  requireStandaloneRuntimeReady, standalone.startSession);
router.post("/standalone/:quizId/submit", validateToken, standaloneQuizRateLimit("submit"),
  requireStandaloneRuntimeReady, standalone.submit);
router.get("/standalone/:quizId", validateToken, standalone.getPublished);
router.get("/admin/standalone/sets", validateToken, requireAdmin, standaloneSets.listAdmin);
router.post("/admin/standalone/sets", validateToken, requireAdmin, standaloneSets.create);
router.get("/admin/standalone/sets/:setId", validateToken, requireAdmin, standaloneSets.getAdmin);
router.put("/admin/standalone/sets/:setId", validateToken, requireAdmin, standaloneSets.update);
router.post("/admin/standalone/sets/:setId/cover", validateToken, requireAdmin, coverUploadLimit,
  coverUpload.single("cover"), validateImageFileContent, standaloneSets.uploadCover);
router.delete("/admin/standalone/sets/:setId/cover", validateToken, requireAdmin, standaloneSets.removeCover);
router.post("/admin/standalone/sets/:setId/activate", validateToken, requireAdmin, standaloneSets.lifecycle("activate"));
router.post("/admin/standalone/sets/:setId/disable", validateToken, requireAdmin, standaloneSets.lifecycle("disable"));
router.post("/admin/standalone/sets/:setId/archive", validateToken, requireAdmin, standaloneSets.lifecycle("archive"));
router.post("/admin/standalone/sets/:setId/restore", validateToken, requireAdmin, standaloneSets.lifecycle("restore"));
router.post("/admin/standalone/sets/:setId/quizzes", validateToken, requireAdmin, standaloneSets.createDraft);
router.put("/admin/standalone/sets/:setId/quizzes/:quizId/order", validateToken, requireAdmin, standaloneSets.orderQuiz);
router.delete("/admin/standalone/sets/:setId", validateToken, requireAdmin, standaloneSets.remove);
router.post("/admin/standalone", validateToken, requireAdmin, standalone.create);
router.get("/admin/standalone", validateToken, requireAdmin, standalone.listAdmin);
router.get("/admin/standalone/:quizId", validateToken, requireAdmin, standalone.getAdmin);
router.put("/admin/standalone/:quizId/draft", validateToken, requireAdmin, standalone.editDraft);
router.post("/admin/standalone/:quizId/publish", validateToken, requireAdmin, standalone.publish);
router.post("/admin/standalone/:quizId/media/retry", validateToken, requireAdmin, standalone.retryMedia);
router.post("/admin/standalone/:quizId/disable", validateToken, requireAdmin, standalone.lifecycle("disable"));
router.post("/admin/standalone/:quizId/enable", validateToken, requireAdmin, standalone.lifecycle("enable"));
router.post("/admin/standalone/:quizId/archive", validateToken, requireAdmin, standalone.lifecycle("archive"));
router.post("/admin/standalone/:quizId/restore", validateToken, requireAdmin, standalone.lifecycle("restore"));
router.delete("/admin/standalone/:quizId", validateToken, requireAdmin, standalone.remove);

function validateQuizImageFields(req, res, next) {
  const invalidFile = (req.files || []).find(
    (file) => !/^question(?:Image|Audio)_\d+$/.test(file.fieldname)
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
router.post("/admin", validateToken, requireAdmin, upload.any(), validateQuizMediaContent, validateQuizImageFields, controller.createQuiz);
router.put("/admin/:quizId", validateToken, requireAdmin, upload.any(), validateQuizMediaContent, validateQuizImageFields, controller.updateQuiz);
router.put("/admin/:quizId/questions/:questionId", validateToken, requireAdmin, upload.any(), validateQuizMediaContent, validateQuizImageFields, controller.updateQuizQuestion);
router.post("/admin/:quizId/questions", validateToken, requireAdmin, upload.any(), validateQuizMediaContent, validateQuizImageFields, controller.createQuizQuestion);
router.post("/admin/:quizId/archive", validateToken, requireAdmin, controller.archiveQuiz);
router.post("/admin/:quizId/restore", validateToken, requireAdmin, controller.restoreQuiz);
router.post("/admin/:quizId/availability", validateToken, requireAdmin, controller.changeQuizAvailability);
router.delete("/admin/:quizId", validateToken, requireAdmin, controller.deleteQuiz);
router.get("/course/:courseId/lesson/:lessonId", validateToken, controller.getStudentQuizzesForLesson);
router.get("/course/:courseId", validateToken, controller.getStudentCourseQuizzes);
router.get("/:quizId/history", validateToken, controller.getStudentQuizHistory);
router.get("/:quizId/attempt-requests", validateToken, controller.getStudentAttemptRequests);
router.post("/:quizId/attempt-requests", validateToken, controller.createStudentAttemptRequest);
router.patch("/:quizId/attempt-requests/:requestId/cancel", validateToken, controller.cancelStudentAttemptRequest);
router.post("/:quizId/sessions", validateToken, controller.startStudentQuizSession);
router.post("/:quizId/submit", validateToken, controller.submitQuiz);

module.exports = router;
