const mongoose = require("mongoose");
const Course = require("../models/courseModel");
const Enrollment = require("../models/enrollmentModel");
const Payment = require("../models/paymentModel");
const PromoCode = require("../models/promoCodeModel");
const Redemption = require("../models/promoRedemptionModel");
const Cleanup = require("../models/paymentProofCleanupModel");
const storage = require("./paymentProofStorage");
const { cleanFailedProof } = require("./paymentProofCleanup");
const { paymentError, paymentTransaction, assertPaymentDatabaseReady } = require("./paymentTransaction");
const { availabilityMessages, getPromoAvailability, calculatePromoDiscount } = require("./promoCodePolicy");
const { calculateCheckout } = require("./checkoutCalculation");

async function validatePurchase(userId, courseId, session = null) {
  const course = await Course.findById(courseId).session(session);
  if (!course) throw paymentError(404, "Course not found");
  if (await Enrollment.exists({ userId, courseId }).session(session)) throw paymentError(400, "You are already enrolled in this course");
  if (await Payment.exists({ userId, courseId, status: "pending" }).session(session)) throw paymentError(400, "You already have a pending payment for this course");
  return course;
}

async function checkPromo(promo, courseId, userId, session = null) {
  const reason = getPromoAvailability(promo, courseId);
  if (reason) throw paymentError(400, availabilityMessages[reason]);
  if (await Redemption.exists({ promoCode: promo._id, userId, active: true }).session(session)) {
    throw paymentError(400, availabilityMessages["already-used"]);
  }
}

async function submitManualPayment({ userId, courseId, paymentMethodId, courseMutationVersion, paymentMethodMutationVersion, code, buffer }) {
  // Fail before touching external storage if deployment/indexes are not ready.
  await assertPaymentDatabaseReady();
  await validatePurchase(userId, courseId);
  const observed = await calculateCheckout({ userId, courseId, paymentMethodId, promoCode: code });
  if (Number(courseMutationVersion) !== observed.coursePrice.mutationVersion || Number(paymentMethodMutationVersion) !== observed.paymentMethod.mutationVersion) throw paymentError(409, "Payment details changed. Review the current quote before submitting.");
  const paymentId = new mongoose.Types.ObjectId();
  const publicId = `arun_thai/payment_proofs/${paymentId}`;
  await Cleanup.create([{ publicId }], { writeConcern: { w: "majority" } });
  let transactionStarted = false;
  try {
    const proof = await storage.uploadPaymentProof(buffer, publicId);
    transactionStarted = true;
    return await paymentTransaction(async (session) => {
      const course = await validatePurchase(userId, courseId, session);
      let quote = await calculateCheckout({ userId, courseId, paymentMethodId, promoCode: code, session });
      if (Number(courseMutationVersion) !== quote.coursePrice.mutationVersion || Number(paymentMethodMutationVersion) !== quote.paymentMethod.mutationVersion) throw paymentError(409, "Payment details changed. Review the current quote before submitting.");
      let promo;
      let redemption;
      let discountAmount = 0;
      if (code) {
        // Shared document write serializes first redemption against admin edits,
        // deletion, archival and other reservations. Retried transactions reread.
        promo = await PromoCode.findOneAndUpdate({ code }, { $inc: { mutationVersion: 1 } }, { session, returnDocument: "after" });
        await checkPromo(promo, courseId, userId, session);
        quote = await calculateCheckout({ userId, courseId, paymentMethodId, promoCode: code, session });
        const now = new Date();
        const reserved = await PromoCode.updateOne({
          _id: promo._id, isActive: true, archivedAt: null,
          $and: [
            { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
            { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
            { $or: [{ usageLimit: null }, { $expr: { $lt: ["$usageCount", "$usageLimit"] } }] },
          ],
        }, { $inc: { usageCount: 1 } }, { session });
        if (!reserved.modifiedCount) throw paymentError(400, "This promo code is no longer available.");
        [redemption] = await Redemption.create([{ promoCode: promo._id, userId, paymentId, active: true }], { session });
        discountAmount = quote.discountAmount;
      }
      const method = quote.paymentMethod;
      const [payment] = await Payment.create([{
        _id: paymentId, userId, courseId,
        courseSnapshot: { title: course.title, description: course.description || "", thumbnail: course.thumbnail || "", price: quote.coursePrice.price, originalPrice: quote.coursePrice.originalPrice, currency: quote.currency },
        currency: quote.currency, paymentMethodId: method.id,
        paymentMethodSnapshot: { schemaVersion: 1, kind: "method", methodId: method.id, methodVersion: method.mutationVersion, name: method.name, currency: method.currency, type: method.type, provider: method.provider, instructions: method.instructions, recipient: method.recipient, qrImage: method.qrImage },
        amount: quote.amount, originalAmount: quote.originalAmount, discountAmount,
        promoCode: promo?.code, promoRedemptionId: redemption?._id,
        paymentProofPublicId: publicId, paymentProofFormat: proof.format,
        paymentProofStorage: "authenticated", status: "pending",
      }], { session });
      // Reference was allocated before either insert. No post-commit link write.
      const removed = await Cleanup.deleteOne({ publicId, state: "staged" }, { session });
      if (removed.deletedCount !== 1) throw paymentError(409, "Payment submission must be retried.");
      return { payment: payment.toObject(), course: course.toObject() };
    });
  } catch (error) {
    // Unknown commit outcome must never trigger destructive compensation.
    // Keep the staged record for offline reconciliation if we cannot record it.
    const uncertain = transactionStarted && error.hasErrorLabel?.("UnknownTransactionCommitResult");
    try {
      await Cleanup.updateOne({ publicId }, { state: uncertain ? "uncertain" : "cleanup" });
      if (!uncertain) await cleanFailedProof(publicId);
    } catch (_cleanupError) {
      console.error("Payment proof reconciliation required.");
    }
    if (uncertain) throw paymentError(503, "Payment confirmation is temporarily unavailable. Check your course orders before trying again.");
    if (error.code === 11000) throw paymentError(409, "A pending payment or promo redemption already exists. Refresh your orders before trying again.");
    throw error;
  }
}

async function reviewManualPayment({ paymentId, adminId, status, rejectReason }) {
  return paymentTransaction(async (session) => {
    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: "pending" },
      { $set: { status, reviewedBy: adminId, reviewedAt: new Date(), ...(status === "rejected" ? { rejectReason } : {}) },
        ...(status === "approved" ? { $unset: { rejectReason: 1 } } : {}) },
      { session, returnDocument: "after", runValidators: true },
    );
    if (!payment) {
      if (!await Payment.exists({ _id: paymentId }).session(session)) throw paymentError(404, "Payment not found");
      throw paymentError(409, "This payment has already been reviewed.");
    }
    const course = await Course.findById(payment.courseId).select("title price").session(session);
    if (status === "approved" && !course) throw paymentError(404, "Course not found");
    if (payment.amount == null) {
      if (!course) throw paymentError(404, "Course not found");
      payment.amount = Number(course.price);
      await payment.save({ session });
    }
    let enrollment;
    if (status === "approved") {
      enrollment = await Enrollment.findOneAndUpdate(
        { userId: payment.userId, courseId: payment.courseId },
        { $setOnInsert: { userId: payment.userId, courseId: payment.courseId, paymentId: payment._id } },
        { session, returnDocument: "after", upsert: true, runValidators: true },
      );
    } else if (payment.promoRedemptionId) {
      const redemption = await Redemption.findOneAndUpdate(
        { _id: payment.promoRedemptionId, active: true },
        { $set: { active: false, releasedAt: new Date(), releaseReason: "payment_rejected", paymentId: payment._id } },
        { session, returnDocument: "after" },
      );
      if (!redemption) throw paymentError(409, "Promo reservation needs reconciliation before review.");
      const released = await PromoCode.updateOne(
        { _id: redemption.promoCode, usageCount: { $gt: 0 } },
        { $inc: { usageCount: -1, mutationVersion: 1 } }, { session },
      );
      if (released.modifiedCount !== 1) throw paymentError(409, "Promo capacity needs reconciliation before review.");
    }
    return { payment: payment.toObject(), course: course?.toObject(), enrollment: enrollment?.toObject() };
  });
}

module.exports = { submitManualPayment, reviewManualPayment };
