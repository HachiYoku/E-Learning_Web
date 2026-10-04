const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const validateToken = require("../middleware/authMiddleware");
const { createStudentFeedback, getMyStudentFeedback, updatePublicationConsent } = require("../controllers/studentFeedbackController");

const router = express.Router();
const feedbackWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || ipKeyGenerator(req.ip)),
  message: { message: "Too many feedback updates. Please try again later." },
});

router.post("/", validateToken, feedbackWriteLimiter, createStudentFeedback);
router.get("/mine", validateToken, getMyStudentFeedback);
router.patch("/:id/publication-consent", validateToken, feedbackWriteLimiter, updatePublicationConsent);

module.exports = router;
