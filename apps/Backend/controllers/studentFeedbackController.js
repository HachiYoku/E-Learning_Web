const mongoose = require("mongoose");
const Enrollment = require("../models/enrollmentModel");
const StudentFeedback = require("../models/studentFeedbackModel");

const MIN_FEEDBACK_LENGTH = 20;
const MAX_FEEDBACK_LENGTH = 2000;
const NAME_PREFERENCES = new Set(["first_name", "anonymous"]);

const isValidId = (value) => mongoose.isValidObjectId(value);
const hasOnlyKeys = (value, allowed) => Object.keys(value || {}).every((key) => allowed.has(key));

function feedbackError(status, message) {
  return Object.assign(new Error(message), { status });
}

function normalizeFeedback(value) {
  if (typeof value !== "string") throw feedbackError(400, "Feedback must be plain text.");
  const feedback = value.trim();
  if (feedback.length < MIN_FEEDBACK_LENGTH || feedback.length > MAX_FEEDBACK_LENGTH) {
    throw feedbackError(400, `Feedback must be between ${MIN_FEEDBACK_LENGTH} and ${MAX_FEEDBACK_LENGTH} characters.`);
  }
  return feedback;
}

async function createStudentFeedback(req, res) {
  try {
    if (!hasOnlyKeys(req.body, new Set(["courseId", "feedback"]))) {
      return res.status(400).json({ message: "Only courseId and feedback may be submitted." });
    }

    const { courseId } = req.body || {};
    if (!isValidId(courseId)) return res.status(400).json({ message: "A valid courseId is required." });
    const originalFeedback = normalizeFeedback(req.body.feedback);

    const enrollment = await Enrollment.findOne({ userId: req.user.id, courseId }).select("completedLessonIds");
    if (!enrollment) return res.status(403).json({ message: "You are not enrolled in this course." });
    if (!(enrollment.completedLessonIds || []).length) {
      return res.status(403).json({ message: "Complete at least one lesson before sharing feedback." });
    }

    const feedback = await StudentFeedback.create({
      studentId: req.user.id,
      courseId,
      originalFeedback,
    });
    return res.status(201).json({ feedback });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "You have already submitted feedback for this course." });
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to submit feedback." });
  }
}

async function getMyStudentFeedback(req, res) {
  try {
    const feedback = await StudentFeedback.find({ studentId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ feedback });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to load your feedback." });
  }
}

async function updatePublicationConsent(req, res) {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "A valid feedback id is required." });
    if (!hasOnlyKeys(req.body, new Set(["status", "namePreference", "allowProfileImage"]))) {
      return res.status(400).json({ message: "Only publication consent fields may be updated." });
    }

    const { status, namePreference, allowProfileImage = false } = req.body || {};
    if (status !== "permitted" && status !== "withdrawn") {
      return res.status(400).json({ message: "Consent status must be permitted or withdrawn." });
    }
    if (status === "permitted" && !NAME_PREFERENCES.has(namePreference)) {
      return res.status(400).json({ message: "A valid name preference is required for publication permission." });
    }
    if (status === "permitted" && typeof allowProfileImage !== "boolean") return res.status(400).json({ message: "Profile image permission must be true or false." });
    if (status === "permitted" && namePreference === "anonymous" && allowProfileImage) return res.status(400).json({ message: "Anonymous sharing cannot include a profile image." });
    if (status === "withdrawn" && namePreference !== undefined) {
      return res.status(400).json({ message: "Name preference cannot be changed while withdrawing permission." });
    }

    const feedback = await StudentFeedback.findOne({ _id: req.params.id, studentId: req.user.id });
    if (!feedback) return res.status(404).json({ message: "Feedback not found." });

    const now = new Date();
    if (status === "permitted") {
      feedback.publicationConsent.status = "permitted";
      feedback.publicationConsent.namePreference = namePreference;
      feedback.publicationConsent.allowProfileImage = namePreference === "first_name" ? allowProfileImage : false;
      feedback.publicationConsent.permittedAt = now;
      feedback.publicationConsent.withdrawnAt = null;
      feedback.publication.status = "awaiting_review";
      feedback.publication.reviewedBy = null;
      feedback.publication.reviewedAt = null;
      feedback.publication.publishedAt = null;
    } else {
      feedback.publicationConsent.status = "withdrawn";
      feedback.publicationConsent.allowProfileImage = false;
      feedback.publicationConsent.withdrawnAt = now;
      feedback.publication.status = "withdrawn";
      feedback.publication.publishedAt = null;
    }

    await feedback.save();
    return res.status(200).json({ feedback });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to update publication permission." });
  }
}

module.exports = {
  MIN_FEEDBACK_LENGTH,
  MAX_FEEDBACK_LENGTH,
  createStudentFeedback,
  getMyStudentFeedback,
  updatePublicationConsent,
};
