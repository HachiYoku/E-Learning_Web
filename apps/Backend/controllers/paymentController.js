const Payment = require("../models/paymentModel");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { createNotification } = require("./notificationController");
const { emitAdminEvent } = require("../realtime/socketServer");
const sendEmail = require("../services/sendEmail");
const { writeAuditLog } = require("../services/auditLogger");
const { submitManualPayment, reviewManualPayment } = require("../services/manualPayment");
const { calculateCheckout, listAvailablePaymentMethods } = require("../services/checkoutCalculation");
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

// External delivery is outside transaction callbacks: callbacks may be retried.
async function afterPaymentCommit(action) {
  try { await action(); } catch (_error) { console.error("Payment follow-up delivery failed after commit."); }
}

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
    if (!req.file?.buffer) return res.status(400).json({ message: "Payment proof is required" });
    const { payment, course } = await submitManualPayment({
      userId: req.user.id, courseId: req.params.courseId,
      paymentMethodId: req.body.paymentMethodId,
      courseMutationVersion: req.body.courseMutationVersion,
      paymentMethodMutationVersion: req.body.paymentMethodMutationVersion,
      code: String(req.body.promoCode || "").trim().toUpperCase(), buffer: req.file.buffer,
    });
    await afterPaymentCommit(async () => emitAdminEvent("admin:payment-updated"));
    await afterPaymentCommit(() => createNotification({
      userId: payment.userId, courseId: course._id, type: "payment",
      title: "Payment proof submitted",
      message: `Your payment proof for ${course.title} is under review. We'll notify you once it has been approved or rejected.`,
      link: `/app/orders/${payment._id}`,
    }));
    return res.status(201).json(serializePayment(payment));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to submit payment" });
  }
};

// Informational only: no proof upload, Payment, PromoRedemption, capacity
// reservation, or enrollment is created by this endpoint.
const quoteCheckout = async (req, res) => {
  try {
    const quote = await calculateCheckout({
      userId: req.user.id, courseId: req.params.courseId,
      paymentMethodId: req.body?.paymentMethodId, promoCode: req.body?.promoCode,
    });
    return res.status(200).json(quote);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to calculate checkout quote" });
  }
};

const getCheckoutPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await listAvailablePaymentMethods({ courseId: req.params.courseId, isAdmin: req.user.role === "admin" });
    return res.status(200).json(paymentMethods);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to load payment methods" });
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

const reviewPayment = (status) => async (req, res) => {
  try {
    const { adminPassword, rejectReason } = req.body || {};
    if (status === "rejected" && (typeof rejectReason !== "string" || !rejectReason.trim())) {
      return res.status(400).json({ message: "Reject reason is required" });
    }
    if (typeof adminPassword !== "string" || !adminPassword.trim()) {
      return res.status(400).json({ message: "Admin password is required to review a payment" });
    }
    const admin = await User.findById(req.user.id).select("+password");
    if (!admin || !bcrypt.compareSync(adminPassword, admin.password)) return res.status(403).json({ message: "Invalid admin password" });
    const { payment, enrollment, course } = await reviewManualPayment({
      paymentId: req.params.paymentId, adminId: req.user.id, status,
      rejectReason: typeof rejectReason === "string" ? rejectReason.trim() : undefined,
    });
    await afterPaymentCommit(async () => emitAdminEvent("admin:payment-updated"));
    await afterPaymentCommit(() => writeAuditLog({
      actorId: req.user.id, action: `payment.${status}`, targetType: "payment", targetId: payment._id,
      metadata: { userId: payment.userId, courseId: payment.courseId, amount: payment.amount, rejectReason: payment.rejectReason },
    }));
    await afterPaymentCommit(() => createNotification({
      userId: payment.userId, courseId: payment.courseId, type: "payment",
      title: status === "approved" ? "Payment approved — course access is ready" : "Payment needs attention",
      message: status === "approved"
        ? `Your payment for ${course?.title || "the course"} was approved. You can now start learning.`
        : `We could not verify your payment for ${course?.title || "the course"}. Please review the reason and submit a new receipt.${payment.promoCode ? " Your promo code was released and can be applied again if it is still valid." : ""}`,
      link: status === "approved" ? "/my-courses" : `/order-status/${payment._id}`,
    }));
    await afterPaymentCommit(async () => {
      const user = await User.findById(payment.userId).select("name email").lean();
      await sendPaymentReviewEmail({ user, courseTitle: course?.title, status, rejectReason: payment.rejectReason });
    });
    return res.status(200).json({
      message: status === "approved" ? "Payment approved and enrollment created successfully" : "Payment rejected successfully",
      payment: serializePayment(payment), ...(enrollment ? { enrollment } : {}),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to review payment" });
  }
};
const approvePayment = reviewPayment("approved");
const rejectPayment = reviewPayment("rejected");

module.exports = {
  createPayment,
  quoteCheckout,
  getCheckoutPaymentMethods,
  getMyPayments,
  getAllPayments,
  getPendingPaymentCount,
  replacePaymentProof,
  getPaymentProofAccess,
  streamAuthorizedPaymentProof,
  approvePayment,
  rejectPayment,
};
