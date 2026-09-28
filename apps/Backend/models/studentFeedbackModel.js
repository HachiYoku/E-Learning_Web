const mongoose = require("mongoose");

const publicationConsentSchema = new mongoose.Schema({
  status: { type: String, enum: ["private", "permitted", "withdrawn"], required: true, default: "private" },
  namePreference: { type: String, enum: ["first_name", "anonymous", null], default: null },
  permittedAt: { type: Date, default: null },
  withdrawnAt: { type: Date, default: null },
}, { _id: false });

const publicationSchema = new mongoose.Schema({
  status: { type: String, enum: ["private", "awaiting_review", "published", "not_selected", "withdrawn"], required: true, default: "private" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
}, { _id: false });

const studentFeedbackSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  originalFeedback: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000, immutable: true },
  publicationConsent: { type: publicationConsentSchema, required: true, default: () => ({}) },
  publication: { type: publicationSchema, required: true, default: () => ({}) },
}, { timestamps: true });

studentFeedbackSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
studentFeedbackSchema.index({ "publicationConsent.status": 1, "publication.status": 1, createdAt: -1 });

module.exports = mongoose.model("StudentFeedback", studentFeedbackSchema);
