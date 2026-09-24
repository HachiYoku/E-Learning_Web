const Course = require("../models/courseModel");
const Enrollment = require("../models/enrollmentModel");
const Payment = require("../models/paymentModel");
const PromoCode = require("../models/promoCodeModel");
const PromoRedemption = require("../models/promoRedemptionModel");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { createNotification } = require("./notificationController");
const { emitAdminEvent } = require("../realtime/socketServer");
const { uploadStream } = require("../services/uploadStream");
const sendEmail = require("../services/sendEmail");
const { writeAuditLog } = require("../services/auditLogger");
const { availabilityMessages, getPromoAvailability, calculatePromoDiscount } = require("../services/promoCodePolicy");
const { getTrustedUrls, buildTrustedUrl } = require("../config/trustedUrls");
const { uploadPaymentProof, migrateLegacyPaymentProof, streamPaymentProof, deletePaymentProof } = require("../services/paymentProofStorage");
const { PAYMENT_PROOF_ACCESS_TTL_SECONDS, issuePaymentProofAccessToken, verifyPaymentProofAccessToken } = require("../services/paymentProofAccess");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const PAYMENT_PROOF_FIELDS = "+paymentImage +paymentImagePublicId +paymentProofPublicId +paymentProofFormat +paymentProofStorage";

const serializePayment = (payment) => {
  const value = typeof payment.toObject === "function" ? payment.toObject() : { ...payment };
  const hasPaymentProof = Boolean(value.paymentProofPublicId || value.paymentImagePublicId || value.paymentImage);
  const proofStorage = value.paymentProofStorage || (hasPaymentProof ? "legacy" : null);
  delete value.paymentImage;
  delete value.paymentImagePublicId;
  delete value.paymentProofPublicId;
  delete value.paymentProofFormat;
  delete value.paymentProofStorage;
  return { ...value, hasPaymentProof, proofStorage };
};

const getPaymentProofRecord = (paymentId) => Payment.findById(paymentId).select(PAYMENT_PROOF_FIELDS);

// Keeps receipt storage and the promo reservation in sync if persistence fails
// after a receipt has already been uploaded.
const rollbackFailedPaymentCreation = async ({ proofPublicId, redemptionId, promoId, deleteProof = deletePaymentProof }) => {
  await deleteProof(proofPublicId).catch(() => undefined);
  if (redemptionId) {
    await PromoRedemption.deleteOne({ _id: redemptionId });
    await PromoCode.updateOne({ _id: promoId, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
  }
};

const sendPaymentReviewEmail = async ({ user, courseTitle, status, rejectReason }) => {
  if (!user?.email) return;

  const safeName = escapeHtml(user.name || "there");
  const safeCourseTitle = escapeHtml(courseTitle || "your course");
  const isApproved = status === "approved";
  const safeReason = escapeHtml(rejectReason);
  const actionUrl = buildTrustedUrl(getTrustedUrls().frontendUrl, isApproved ? "/my-courses" : "/my-course-order");
  const accentColor = isApproved ? "#4D7C57" : "#C97112";
  const statusLabel = isApproved ? "PAYMENT APPROVED" : "PAYMENT NEEDS ATTENTION";
  const heading = isApproved ? "Your enrollment is confirmed" : "Let’s resolve your payment";
  const message = isApproved
    ? `Your payment has been verified and <strong>you now have access</strong> to your course.`
    : "We were unable to verify the receipt you submitted. Please review the details below and submit a new one.";
  const buttonLabel = isApproved ? "Start learning" : "View order details";
  const reasonCard = isApproved
    ? ""
    : `
      <tr>
        <td style="padding: 0 32px 24px;">
          <div style="border-left: 4px solid #E58C1A; background: #FFF8E8; border-radius: 0 12px 12px 0; padding: 16px 18px; color: #765F55; font-size: 14px; line-height: 22px;">
            <strong style="display: block; color: #2D2E30; margin-bottom: 4px;">Review note</strong>
            ${safeReason}
          </div>
        </td>
      </tr>`;
  const subject = isApproved
    ? `Enrollment approved: ${courseTitle || "your course"}`
    : `Payment update: ${courseTitle || "your course"}`;
  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #FFF9EA; font-family: Arial, Helvetica, sans-serif; color: #2D2E30;">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${isApproved ? "Your course is ready to explore." : "Your payment receipt needs an update."}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #FFF9EA;">
          <tr>
            <td align="center" style="padding: 32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(45, 46, 48, 0.08);">
                <tr>
                  <td style="padding: 28px 32px; background: #2D2E30; color: #FFFFFF;">
                    <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 27px; font-style: italic; line-height: 1;">Arun Thai</div>
                    <div style="margin-top: 8px; color: #F8C56A; font-size: 11px; font-weight: bold; letter-spacing: 1.7px;">LEARN WITH CONFIDENCE</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 32px 20px;">
                    <div style="display: inline-block; padding: 7px 10px; border-radius: 999px; background: ${isApproved ? "#E9F4EA" : "#FFF1D0"}; color: ${accentColor}; font-size: 11px; font-weight: bold; letter-spacing: 0.8px;">${statusLabel}</div>
                    <h1 style="margin: 20px 0 12px; font-size: 28px; line-height: 36px; letter-spacing: -0.4px;">${heading}</h1>
                    <p style="margin: 0; color: #765F55; font-size: 16px; line-height: 25px;">Hi ${safeName},</p>
                    <p style="margin: 14px 0 0; color: #765F55; font-size: 16px; line-height: 25px;">${message}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 32px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #FFFDF8; border: 1px solid #EEE7DC; border-radius: 12px;">
                      <tr>
                        <td style="padding: 17px 18px;">
                          <div style="color: #9B867C; font-size: 11px; font-weight: bold; letter-spacing: 0.9px; text-transform: uppercase;">Course</div>
                          <div style="margin-top: 5px; color: #2D2E30; font-size: 16px; font-weight: bold; line-height: 23px;">${safeCourseTitle}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${reasonCard}
                <tr>
                  <td align="center" style="padding: 4px 32px 36px;">
                    <a href="${escapeHtml(actionUrl)}" style="display: inline-block; border-radius: 10px; background: ${isApproved ? "#F8C56A" : "#E58C1A"}; color: #2D2E30; padding: 14px 24px; font-size: 15px; font-weight: bold; text-decoration: none;">${buttonLabel}</a>
                  </td>
                </tr>
              </table>
              <p style="max-width: 600px; margin: 18px 0 0; color: #9B867C; font-size: 12px; line-height: 18px; text-align: center;">This is an automated notification from Arun Thai. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>`;

  try {
    await sendEmail(user.email, subject, html);
  } catch (error) {
    console.warn(`Failed to send ${status} payment email to ${user.email}:`, error.message);
  }
};

const createPayment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const promoCode = String(req.body.promoCode || "").trim().toUpperCase();

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (promoCode && Number(course.originalPrice ?? course.price) > Number(course.price)) {
      return res.status(400).json({ message: "This course is already discounted, so a promo code cannot be applied." });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Payment proof is required" });
    }

    const existingEnrollment = await Enrollment.findOne({
      userId: req.user.id,
      courseId,
    });
    if (existingEnrollment) {
      return res.status(400).json({ message: "You are already enrolled in this course" });
    }

    const existingPendingPayment = await Payment.findOne({
      userId: req.user.id,
      courseId,
      status: "pending",
    });
    if (existingPendingPayment) {
      return res.status(400).json({
        message: "You already have a pending payment for this course",
      });
    }

    // Reject an invalid promo before uploading a private receipt. The same
    // checks are repeated after upload because another redemption or admin
    // change may occur while the upload is in flight.
    if (promoCode) {
      const preflightPromo = await PromoCode.findOne({ code: promoCode });
      const reason = getPromoAvailability(preflightPromo, course._id);
      if (reason) return res.status(400).json({ message: availabilityMessages[reason] });
      if (await PromoRedemption.exists({ promoCode: preflightPromo._id, userId: req.user.id })) return res.status(400).json({ message: availabilityMessages["already-used"] });
    }

    const uploadedProof = await uploadPaymentProof(req.file.buffer);

    const originalAmount = Number(course.price || 0); let discountAmount = 0; let promo; let redemption;
    if (promoCode) {
      promo = await PromoCode.findOne({ code: promoCode }); const now = new Date();
      const reason = getPromoAvailability(promo, course._id, now);
      if (reason) { await deletePaymentProof(uploadedProof.public_id).catch(() => undefined); return res.status(400).json({ message: availabilityMessages[reason] }); }
      try { redemption = await PromoRedemption.create({ promoCode: promo._id, userId: req.user.id }); }
      catch (error) { await deletePaymentProof(uploadedProof.public_id).catch(() => undefined); if (error.code === 11000) return res.status(400).json({ message: availabilityMessages["already-used"] }); throw error; }
      promo = await PromoCode.findOneAndUpdate({ _id: promo._id, isActive: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] }, { $or: [{ usageLimit: null }, { $expr: { $lt: ["$usageCount", "$usageLimit"] } }] }] }, { $inc: { usageCount: 1 } }, { new: true });
      if (!promo) { await PromoRedemption.deleteOne({ _id: redemption._id }); await deletePaymentProof(uploadedProof.public_id).catch(() => undefined); return res.status(400).json({ message: "This promo code is no longer available." }); }
      discountAmount = calculatePromoDiscount(originalAmount, promo).discountAmount;
    }
    let payment;
    try {
      payment = await Payment.create({ userId: req.user.id, courseId, courseSnapshot: { title: course.title, description: course.description || "", thumbnail: course.thumbnail || "", price: originalAmount }, amount: originalAmount - discountAmount, originalAmount, discountAmount, promoCode: promo?.code, promoRedemptionId: redemption?._id, paymentProofPublicId: uploadedProof.public_id, paymentProofFormat: uploadedProof.format, paymentProofStorage: "authenticated", status: "pending" });
      emitAdminEvent("admin:payment-updated");
      if (redemption) await PromoRedemption.updateOne({ _id: redemption._id }, { paymentId: payment._id });
    } catch (error) {
      await rollbackFailedPaymentCreation({ proofPublicId: uploadedProof.public_id, redemptionId: redemption?._id, promoId: promo?._id });
      if (error.code === 11000) return res.status(400).json({ message: "You already have a pending payment for this course." }); throw error;
    }

    // The receipt and payment are already durable at this point. A transient
    // notification failure must not make the student think their upload failed.
    await createNotification({
      userId: payment.userId,
      courseId: course._id,
      type: "payment",
      title: "Payment proof submitted",
      message: `Your payment proof for ${course.title} is under review. We'll notify you once it has been approved or rejected.`,
      link: `/app/orders/${payment._id}`,
    }).catch((notificationError) => {
      console.warn("Failed to create payment-submission notification:", notificationError.message);
    });

    return res.status(201).json(serializePayment(payment));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id }).select(PAYMENT_PROOF_FIELDS)
      .populate("courseId", "title price thumbnail")
      .sort({ createdAt: -1 });

    return res.status(200).json(payments.map(serializePayment));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().select(PAYMENT_PROOF_FIELDS)
      .populate("userId", "name email avatar")
      .populate("courseId", "title price")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json(payments.map(serializePayment));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const replacePaymentProof = async (req, res) => {
  let uploadedProof;
  try {
    if (!req.file?.buffer) return res.status(400).json({ message: "Payment proof is required" });
    const payment = await Payment.findOne({ _id: req.params.paymentId, userId: req.user.id, status: "pending" }).select(PAYMENT_PROOF_FIELDS);
    if (!payment) return res.status(404).json({ message: "Pending payment not found" });

    uploadedProof = await uploadPaymentProof(req.file.buffer);
    const previousPublicId = payment.paymentProofPublicId || payment.paymentImagePublicId;
    const previousWasLegacy = payment.paymentProofStorage !== "authenticated";
    payment.paymentProofPublicId = uploadedProof.public_id;
    payment.paymentProofFormat = uploadedProof.format;
    payment.paymentProofStorage = "authenticated";
    payment.paymentImage = undefined;
    payment.paymentImagePublicId = undefined;
    await payment.save();
    emitAdminEvent("admin:payment-updated");
    if (previousPublicId) await deletePaymentProof(previousPublicId, { legacy: previousWasLegacy }).catch(() => undefined);
    return res.status(200).json(serializePayment(payment));
  } catch (error) {
    if (uploadedProof?.public_id) await deletePaymentProof(uploadedProof.public_id).catch(() => undefined);
    return res.status(500).json({ message: "Unable to replace payment proof" });
  }
};

const getPaymentProofAccess = async (req, res) => {
  try {
    const payment = await getPaymentProofRecord(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.paymentProofStorage !== "authenticated" || !payment.paymentProofPublicId) {
      if (!payment.paymentImage) {
        return res.status(410).json({ message: "This legacy payment proof cannot be migrated because its original image is unavailable." });
      }
      const migratedProof = await migrateLegacyPaymentProof(payment.paymentImage);
      const legacyPublicId = payment.paymentImagePublicId;
      payment.paymentProofPublicId = migratedProof.public_id;
      payment.paymentProofFormat = migratedProof.format;
      payment.paymentProofStorage = "authenticated";
      payment.paymentImage = undefined;
      payment.paymentImagePublicId = undefined;
      await payment.save();
      if (legacyPublicId) await deletePaymentProof(legacyPublicId, { legacy: true }).catch(() => undefined);
    }
    const token = issuePaymentProofAccessToken({ paymentId: payment._id, adminId: req.user.id });
    return res.status(200).json({
      url: buildTrustedUrl(getTrustedUrls().backendUrl, `/payments/${payment._id}/proof`, { token }),
      expiresAt: new Date(Date.now() + PAYMENT_PROOF_ACCESS_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to create payment proof access link" });
  }
};

const streamAuthorizedPaymentProof = async (req, res) => {
  try {
    const access = verifyPaymentProofAccessToken(req.query?.token, req.params.paymentId);
    const admin = await User.findById(access.adminId).select("role isActive");
    if (!admin || !admin.isActive || admin.role !== "admin") return res.status(403).json({ message: "Admin access only" });
    const payment = await getPaymentProofRecord(req.params.paymentId);
    if (!payment || payment.paymentProofStorage !== "authenticated" || !payment.paymentProofPublicId) return res.status(404).json({ message: "Payment proof not found" });
    const proof = await streamPaymentProof(payment.paymentProofPublicId, payment.paymentProofFormat);
    res.status(200).set({
      "Content-Type": proof.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    // Uploads are limited to 5 MB. Sending a buffered response avoids mixing
    // Fetch's Web ReadableStream with Express' Node response stream, which can
    // make a valid private Cloudinary image fail only at this proxy boundary.
    const imageBuffer = Buffer.from(await proof.arrayBuffer());
    return res.send(imageBuffer);
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.status === 401 || error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Payment proof access link is invalid or expired" });
    }
    // Operational detail is retained only on the server. Never log a signed
    // delivery URL or the admin access token.
    const safeMessage = String(error.message || "unknown error").replace(/https?:\/\/\S+/gi, "[redacted-url]");
    console.error("Secure payment-proof delivery failed", { name: error.name, message: safeMessage });
    return res.status(502).json({ message: "Payment proof is temporarily unavailable" });
  }
};

const getPendingPaymentCount = async (_req, res) => {
  try {
    return res.status(200).json({ count: await Payment.countDocuments({ status: "pending" }) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const approvePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { adminPassword } = req.body || {};

    if (typeof adminPassword !== "string" || !adminPassword.trim()) {
      return res.status(400).json({ message: "Admin password is required to approve a payment" });
    }

    const adminUser = await User.findById(req.user?.id).select("+password");
    if (!adminUser) {
      return res.status(403).json({ message: "Admin user not found" });
    }

    const isAdminPasswordValid = bcrypt.compareSync(adminPassword, adminUser.password);
    if (!isAdminPasswordValid) {
      return res.status(403).json({ message: "Invalid admin password" });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({ message: "Only pending payments can be approved" });
    }

    const course = await Course.findById(payment.courseId).select("title price");
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (payment.amount == null) {
      payment.amount = Number(course.price || 0);
    }

    payment.status = "approved";
    payment.reviewedBy = req.user.id;
    payment.reviewedAt = new Date();
    payment.rejectReason = undefined;
    await payment.save();
    emitAdminEvent("admin:payment-updated");

    await writeAuditLog({
      actorId: req.user.id,
      action: "payment.approved",
      targetType: "payment",
      targetId: payment._id,
      metadata: {
        userId: payment.userId,
        courseId: payment.courseId,
        amount: payment.amount,
      },
    });

    const enrollment = await Enrollment.findOneAndUpdate(
      {
        userId: payment.userId,
        courseId: payment.courseId,
      },
      {
        userId: payment.userId,
        courseId: payment.courseId,
        paymentId: payment._id,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    await createNotification({
      userId: payment.userId,
      courseId: payment.courseId,
      type: "payment",
      title: "Payment approved — course access is ready",
      message: `Your payment for ${course?.title || "the course"} was approved. You can now start learning.`,
      link: "/my-courses",
    });

    const user = await User.findById(payment.userId).select("name email").lean();
    await sendPaymentReviewEmail({
      user,
      courseTitle: course.title,
      status: "approved",
    });

    return res.status(200).json({
      message: "Payment approved and enrollment created successfully",
      payment: serializePayment(payment),
      enrollment,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const rejectPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { rejectReason, adminPassword } = req.body || {};

    if (!rejectReason || !rejectReason.trim()) {
      return res.status(400).json({ message: "Reject reason is required" });
    }

    if (typeof adminPassword !== "string" || !adminPassword.trim()) {
      return res.status(400).json({ message: "Admin password is required to deny a payment" });
    }

    const adminUser = await User.findById(req.user?.id).select("+password");
    if (!adminUser) {
      return res.status(403).json({ message: "Admin user not found" });
    }

    const isAdminPasswordValid = bcrypt.compareSync(adminPassword, adminUser.password);
    if (!isAdminPasswordValid) {
      return res.status(403).json({ message: "Invalid admin password" });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({ message: "Only pending payments can be rejected" });
    }

    if (payment.amount == null) {
      const course = await Course.findById(payment.courseId).select("price");
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      payment.amount = Number(course.price || 0);
    }

    payment.status = "rejected";
    payment.reviewedBy = req.user.id;
    payment.reviewedAt = new Date();
    payment.rejectReason = rejectReason.trim();
    await payment.save();
    emitAdminEvent("admin:payment-updated");

    if (payment.promoRedemptionId) {
      const redemption = await PromoRedemption.findByIdAndDelete(payment.promoRedemptionId);
      if (redemption) await PromoCode.updateOne({ _id: redemption.promoCode, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
    }

    await writeAuditLog({
      actorId: req.user.id,
      action: "payment.rejected",
      targetType: "payment",
      targetId: payment._id,
      metadata: {
        userId: payment.userId,
        courseId: payment.courseId,
        amount: payment.amount,
        rejectReason: payment.rejectReason,
      },
    });

    const course = await Course.findById(payment.courseId).select("title");

    await createNotification({
      userId: payment.userId,
      courseId: payment.courseId,
      type: "payment",
      title: "Payment needs attention",
      message: `We could not verify your payment for ${course?.title || "the course"}. Please review the reason and submit a new receipt.${payment.promoCode ? " Your promo code was released and can be applied again if it is still valid." : ""}`,
      link: `/order-status/${payment._id}`,
    });

    const user = await User.findById(payment.userId).select("name email").lean();
    await sendPaymentReviewEmail({
      user,
      courseTitle: course?.title,
      status: "rejected",
      rejectReason: payment.rejectReason,
    });

    return res.status(200).json({ message: "Payment rejected successfully", payment: serializePayment(payment) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createPayment,
  getMyPayments,
  getAllPayments,
  getPendingPaymentCount,
  replacePaymentProof,
  getPaymentProofAccess,
  streamAuthorizedPaymentProof,
  approvePayment,
  rejectPayment,
  rollbackFailedPaymentCreation,
};
