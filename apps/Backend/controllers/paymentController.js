const Course = require("../models/courseModel");
const Enrollment = require("../models/enrollmentModel");
const Payment = require("../models/paymentModel");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { createNotification } = require("./notificationController");
const { uploadStream } = require("../services/uploadStream");
const sendEmail = require("../services/sendEmail");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getFrontendUrl = () => {
  const localUrl = process.env.FRONTEND_URL;
  const productionUrl = process.env.FRONTEND_URL_PROD;
  const url = process.env.NODE_ENV === "production"
    ? productionUrl || localUrl
    : localUrl || productionUrl || "http://localhost:5173";

  return url.replace(/\/$/, "");
};

const sendPaymentReviewEmail = async ({ user, courseTitle, status, rejectReason }) => {
  if (!user?.email) return;

  const safeName = escapeHtml(user.name || "there");
  const safeCourseTitle = escapeHtml(courseTitle || "your course");
  const isApproved = status === "approved";
  const safeReason = escapeHtml(rejectReason);
  const appUrl = getFrontendUrl();
  const actionUrl = isApproved ? `${appUrl}/my-courses` : `${appUrl}/my-course-order`;
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

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
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

    const uploadedProof = await uploadStream(
      req.file.buffer,
      "english_kafe/payment_proofs"
    );

    const payment = await Payment.create({
      userId: req.user.id,
      courseId,
      amount: Number(course.price || 0),
      paymentImage: uploadedProof.secure_url,
      paymentImagePublicId: uploadedProof.public_id,
      status: "pending",
    });

    return res.status(201).json(payment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate("courseId", "title price thumbnail")
      .sort({ createdAt: -1 });

    return res.status(200).json(payments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("userId", "name email avatar")
      .populate("courseId", "title price")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json(payments);
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

    const adminUser = await User.findById(req.user?.id);
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
      type: "payment",
      title: "Payment approved",
      message: `Your payment for ${course?.title || "the course"} has been approved. You now have access to the course.`,
      link: "/my-courses",
    });

    await createNotification({
      userId: payment.userId,
      type: "enrollment",
      title: "Enrollment confirmed",
      message: `You are now enrolled in ${course?.title || "the course"}. Start learning today!`,
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
      payment,
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

    const adminUser = await User.findById(req.user?.id);
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

    const course = await Course.findById(payment.courseId).select("title");

    await createNotification({
      userId: payment.userId,
      type: "payment",
      title: "Payment needs attention",
      message: `We could not verify your payment for ${course?.title || "the course"}. Please review the reason and submit a new receipt.`,
      link: `/order-status/${payment._id}`,
    });

    const user = await User.findById(payment.userId).select("name email").lean();
    await sendPaymentReviewEmail({
      user,
      courseTitle: course?.title,
      status: "rejected",
      rejectReason: payment.rejectReason,
    });

    return res.status(200).json({ message: "Payment rejected successfully", payment });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createPayment,
  getMyPayments,
  getAllPayments,
  approvePayment,
  rejectPayment,
};
