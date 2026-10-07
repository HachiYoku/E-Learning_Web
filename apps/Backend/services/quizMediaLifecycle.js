const QuizMedia = require("../models/quizMediaModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizSession = require("../models/quizSessionModel");
const Quiz = require("../models/quizModel");
const cloudinary = require("../config/cloudinary");

function mediaValues(question) {
  return [
    question.imagePublicId && { mediaType: "image", publicId: question.imagePublicId, resourceType: question.imageResourceType || "image", url: question.image, format: question.imageFormat || "" },
    question.audioPublicId && { mediaType: "audio", publicId: question.audioPublicId, resourceType: question.audioResourceType || "video", url: question.audio, format: question.audioFormat || "" },
  ].filter(Boolean);
}

async function registerQuizMedia(quiz) {
  for (const question of quiz.questions || []) {
    for (const media of mediaValues(question)) {
      await QuizMedia.updateOne(
        { publicId: media.publicId },
        { $setOnInsert: { quiz: quiz._id, questionId: question._id, ...media }, $set: { cleanupState: "active", cleanupError: "" } },
        { upsert: true }
      );
    }
  }
}

async function isHistoricallyReferenced(publicId) {
  return Boolean(await QuizAttempt.exists({
    $or: [
      { "submissionSnapshot.questions.image.publicId": publicId },
      { "submissionSnapshot.questions.audio.publicId": publicId },
    ],
  }));
}

async function cleanupQuizMedia(record) {
  if (!record || record.cleanupState === "deleted" || await isHistoricallyReferenced(record.publicId)) return false;
  if (await Quiz.exists({ $or: [{ "questions.imagePublicId": record.publicId }, { "questions.audioPublicId": record.publicId }] })) return false;
  if (await QuizSession.exists({ invalidatedAt: null, expiresAt: { $gt: new Date() }, $or: [{ "snapshot.questions.imagePublicId": record.publicId }, { "snapshot.questions.audioPublicId": record.publicId }] })) {
    await QuizMedia.updateOne({ _id: record._id }, { $set: { cleanupState: "pending_cleanup" } });
    return false;
  }
  try {
    await cloudinary.uploader.destroy(record.publicId, { resource_type: record.resourceType, type: "upload", invalidate: true });
    await QuizMedia.updateOne({ _id: record._id }, { $set: { cleanupState: "deleted", cleanupError: "" } });
    return true;
  } catch (error) {
    await QuizMedia.updateOne({ _id: record._id }, { $set: { cleanupState: "cleanup_failed", cleanupError: error?.name || "cleanup_failed" } });
    return false;
  }
}

async function reconcileReplacedQuizMedia(previousQuiz, nextQuiz) {
  const active = new Set((nextQuiz.questions || []).flatMap(mediaValues).map((media) => media.publicId));
  const oldIds = (previousQuiz.questions || []).flatMap(mediaValues).map((media) => media.publicId).filter((id) => !active.has(id));
  const records = await QuizMedia.find({ quiz: previousQuiz._id, publicId: { $in: oldIds }, cleanupState: { $ne: "deleted" } });
  await Promise.all(records.map(cleanupQuizMedia));
}

module.exports = { registerQuizMedia, cleanupQuizMedia, reconcileReplacedQuizMedia, isHistoricallyReferenced };
