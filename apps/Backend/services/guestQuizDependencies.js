const GuestQuizSession = require("../models/guestQuizSessionModel");
const GuestQuizAttempt = require("../models/guestQuizAttemptModel");

async function guestQuizHasDependencies(quizId, session) {
  const options = session ? { session } : {};
  return Boolean(await GuestQuizSession.exists({ quiz: quizId }).setOptions(options)
    || await GuestQuizAttempt.exists({ quiz: quizId }).setOptions(options));
}

function guestMediaReferenceFilter(publicId) {
  return { $or: [
    { "snapshot.questions.imagePublicId": publicId },
    { "snapshot.questions.audioPublicId": publicId },
    { "submissionSnapshot.questions.image.publicId": publicId },
    { "submissionSnapshot.questions.audio.publicId": publicId },
  ] };
}

async function guestMediaIsProtected(publicId, now = new Date()) {
  const sessionFilter = { expiresAt: { $gt: now }, invalidatedAt: null,
    $or: guestMediaReferenceFilter(publicId).$or.slice(0, 2) };
  const attemptFilter = { expiresAt: { $gt: now },
    $or: guestMediaReferenceFilter(publicId).$or.slice(2) };
  return Boolean(await GuestQuizSession.exists(sessionFilter) || await GuestQuizAttempt.exists(attemptFilter));
}

module.exports = { guestQuizHasDependencies, guestMediaIsProtected };
