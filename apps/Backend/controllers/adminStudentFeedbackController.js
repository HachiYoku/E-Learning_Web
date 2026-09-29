const mongoose = require("mongoose");
const StudentFeedback = require("../models/studentFeedbackModel");
const { derivePublicDisplayName } = require("../services/studentFeedbackDisplayName");
const { writeAuditLog } = require("../services/auditLogger");

const REVIEW_STATUSES = new Set(["awaiting_review", "published", "not_selected", "withdrawn", "private"]);
const DECISIONS = new Set(["published", "not_selected"]);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_PAGE = 10000;

function validId(value) { return typeof value === "string" && mongoose.isValidObjectId(value); }

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

function preview(feedback, includeReviewDetails = true) {
  const student = feedback.studentId || {};
  const course = feedback.courseId || {};
  const result = {
    _id: feedback._id,
    student: { id: student._id || null, name: student.name || "Student unavailable", ...(includeReviewDetails ? { email: student.email || "", profileImage: feedback.publicationConsent?.status === "permitted" && feedback.publicationConsent?.namePreference === "first_name" && feedback.publicationConsent?.allowProfileImage === true && student.avatar ? student.avatar : null } : {}) },
    course: { id: course._id || null, title: course.title || "Course unavailable" },
    createdAt: feedback.createdAt,
    publicationConsent: feedback.publicationConsent,
    publication: feedback.publication,
    publicNamePreview: derivePublicDisplayName(student.name, feedback.publicationConsent?.namePreference),
  };
  if (includeReviewDetails) return { ...result, originalFeedback: feedback.originalFeedback };
  return result;
}

function populateAdmin(query) {
  return query
    .populate("studentId", "name email avatar")
    .populate("courseId", "title")
    .populate("publication.reviewedBy", "name email");
}

async function listAdminStudentFeedback(req, res) {
  const page = parsePositiveInteger(req.query.page, 1, MAX_PAGE);
  const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const status = req.query.status;
  if (!page || !limit) return res.status(400).json({ message: `page must be between 1 and ${MAX_PAGE}; limit must be between 1 and ${MAX_LIMIT}.` });
  if (status !== undefined && !REVIEW_STATUSES.has(status)) return res.status(400).json({ message: "Unsupported publication status." });
  if (req.query.courseId !== undefined && !validId(req.query.courseId)) return res.status(400).json({ message: "A valid course id is required." });

  const query = {};
  if (status) query["publication.status"] = status;
  if (req.query.courseId) query.courseId = req.query.courseId;
  try {
    const [records, total] = await Promise.all([
      populateAdmin(StudentFeedback.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)).lean(),
      StudentFeedback.countDocuments(query),
    ]);
    return res.json({ feedback: records.map((record) => preview(record, false)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to load student feedback." });
  }
}

async function getAdminStudentFeedback(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: "A valid feedback id is required." });
  try {
    const feedback = await populateAdmin(StudentFeedback.findById(req.params.id)).lean();
    if (!feedback) return res.status(404).json({ message: "Feedback not found." });
    return res.json({ feedback: preview(feedback) });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to load student feedback." });
  }
}

async function updateAdminStudentFeedbackPublication(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: "A valid feedback id is required." });
  if (!req.body || Object.keys(req.body).length !== 1 || !DECISIONS.has(req.body.status)) return res.status(400).json({ message: "Publication status must be published or not_selected." });
  try {
    const feedback = await StudentFeedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Feedback not found." });
    const currentStatus = feedback.publication.status;
    const canPublish = req.body.status === "published" && ["awaiting_review", "not_selected"].includes(currentStatus);
    const canRemove = req.body.status === "not_selected" && currentStatus === "published";
    const canInitialNotSelected = req.body.status === "not_selected" && currentStatus === "awaiting_review";
    if (feedback.publicationConsent.status !== "permitted" || !(canPublish || canRemove || canInitialNotSelected)) {
      return res.status(409).json({ message: "This feedback is no longer eligible for a publication decision. Refresh and review its current status." });
    }
    const now = new Date();
    feedback.publication.status = req.body.status;
    feedback.publication.reviewedBy = req.user.id;
    feedback.publication.reviewedAt = now;
    feedback.publication.publishedAt = req.body.status === "published" ? now : null;
    await feedback.save();
    await writeAuditLog({ actorId: req.user.id, action: req.body.status === "not_selected" && currentStatus === "published" ? "student_feedback.removed_from_website" : `student_feedback.${req.body.status}`, targetType: "student_feedback", targetId: feedback._id, metadata: { feedbackId: String(feedback._id), courseId: String(feedback.courseId), resultingPublicationStatus: req.body.status } });
    const updated = await populateAdmin(StudentFeedback.findById(feedback._id)).lean();
    return res.json({ feedback: preview(updated) });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to update feedback publication status." });
  }
}

module.exports = { listAdminStudentFeedback, getAdminStudentFeedback, updateAdminStudentFeedbackPublication, MAX_LIMIT };
