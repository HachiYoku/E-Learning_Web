const mongoose = require("mongoose");
const User = require("../models/userModel");
const Enrollment = require("../models/enrollmentModel");
const PersonalFlashcardDeck = require("../models/personalFlashcardDeckModel");
const PersonalFlashcard = require("../models/personalFlashcardModel");
const FlashcardReviewProgress = require("../models/flashcardReviewProgressModel");
const QuizAttempt = require("../models/quizAttemptModel");
const Notification = require("../models/notificationModel");
const SupportTicket = require("../models/supportTicketModel");
const RefreshSession = require("../models/refreshSessionModel");
const AuditLog = require("../models/auditLogModel");
const AccountAssetCleanup = require("../models/accountAssetCleanupModel");
const { cleanAccountAsset } = require("./accountAssetCleanup");
const AccountDeletionConfirmation = require("../models/accountDeletionConfirmationModel");
const { hashConfirmationToken, validConfirmationToken } = require("./accountDeletionConfirmation");

const deletionError = (status, message) => Object.assign(new Error(message), { status });

function validId(value) {
  return mongoose.isValidObjectId(value);
}

/**
 * Deletes only private, student-owned account data. Payment, promo, campaign
 * and audit history intentionally remain outside this lifecycle transaction.
 */
async function deleteStudentAccount(userId, { actorId, initiatedBy, deletionConfirmationToken, deletionConfirmationSessionVersion } = {}) {
  if (!validId(userId)) throw deletionError(404, "Student account not found.");
  if (!validId(actorId)) throw deletionError(401, "User is not authorized.");

  let cleanupId = null;
  const result = await mongoose.connection.transaction(async (session) => {
    const student = await User.findById(userId).select("name email role avatarPublicId sessionVersion").session(session);
    if (!student || student.role !== "user") throw deletionError(404, "Student account not found.");
    if (initiatedBy === "admin" && String(student._id) === String(actorId)) {
      throw deletionError(400, "Administrators cannot delete themselves through the student account endpoint.");
    }
    if (initiatedBy === "self") {
      if (!validConfirmationToken(deletionConfirmationToken)) {
        throw deletionError(400, "A recent password confirmation is required to delete your account.");
      }
      const confirmation = await AccountDeletionConfirmation.findOneAndDelete({
        userId: student._id,
        tokenHash: hashConfirmationToken(deletionConfirmationToken),
        sessionVersion: Number(deletionConfirmationSessionVersion || 0),
        expiresAt: { $gt: new Date() },
      }, { session });
      if (!confirmation) throw deletionError(403, "Your password confirmation has expired. Please try again.");
    }

    await Promise.all([
      Enrollment.deleteMany({ userId: student._id }, { session }),
      PersonalFlashcard.deleteMany({ ownerId: student._id }, { session }),
      FlashcardReviewProgress.deleteMany({ userId: student._id }, { session }),
      PersonalFlashcardDeck.deleteMany({ ownerId: student._id }, { session }),
      QuizAttempt.deleteMany({ user: student._id }, { session }),
      Notification.deleteMany({ userId: student._id }, { session }),
      SupportTicket.deleteMany({ studentId: student._id }, { session }),
      AccountDeletionConfirmation.deleteMany({ userId: student._id }, { session }),
      RefreshSession.updateMany({ userId: student._id, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session }),
    ]);

    if (student.avatarPublicId) {
      const [cleanup] = await AccountAssetCleanup.create([{ publicId: student.avatarPublicId }], { session });
      cleanupId = cleanup._id;
    }

    await AuditLog.create([{
      actorId,
      action: initiatedBy === "self" ? "user.self_deleted" : "user.deleted",
      targetType: "user",
      targetId: student._id,
      metadata: { email: student.email, name: student.name, initiatedBy },
    }], { session });

    await student.deleteOne({ session });
    return { userId: student._id, hadAvatar: Boolean(student.avatarPublicId) };
  });

  // This runs only after commit. A failure is persisted by the outbox rather
  // than changing a successful account deletion into a false failure.
  const assetCleanup = cleanupId ? await cleanAccountAsset(cleanupId) : { cleaned: true };
  return { ...result, assetCleanup };
}

module.exports = { deleteStudentAccount, deletionError };
