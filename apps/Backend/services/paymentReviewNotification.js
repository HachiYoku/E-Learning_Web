const sendEmail = require("./sendEmail");
const { buildTrustedUrl, getTrustedUrls } = require("../config/trustedUrls");

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const formatAmount = (amount, currency) => {
  const value = Number(amount || 0).toLocaleString("en-US");
  return currency === "MMK" ? `Ks ${value}` : `฿${value}`;
};

const formatSubmittedAt = (value) => `${new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
}).format(new Date(value))} UTC`;

async function sendAdminPaymentReviewNotification({ payment, studentName, courseTitle }) {
  const recipient = String(process.env.ADMIN_PAYMENT_NOTIFICATION_EMAIL || "").trim();
  if (!recipient) {
    console.warn("Admin payment-review notification skipped: ADMIN_PAYMENT_NOTIFICATION_EMAIL is not configured.");
    return { sent: false, reason: "missing_recipient" };
  }

  const { adminUrl } = getTrustedUrls();
  if (!adminUrl) {
    console.warn("Admin payment-review notification skipped: trusted Admin URL is not configured.");
    return { sent: false, reason: "missing_admin_url" };
  }

  const reviewUrl = buildTrustedUrl(adminUrl, "/review-payment", { payment: payment._id });
  const safeStudentName = escapeHtml(studentName || "Learner");
  const safeCourseTitle = escapeHtml(courseTitle || payment.courseSnapshot?.title || "Course");
  const safeAmount = escapeHtml(formatAmount(payment.amount, payment.currency));
  const safeSubmittedAt = escapeHtml(formatSubmittedAt(payment.createdAt));
  const paymentReferenceRow = payment.paymentReference
    ? `<br><strong style="color:#2D2E30;">Payment Reference:</strong> ${escapeHtml(payment.paymentReference)}`
    : "";
  const safeReviewUrl = escapeHtml(reviewUrl);
  const subject = "New payment proof requires review";
  const html = `
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#FFF9EA;font-family:Arial,Helvetica,sans-serif;color:#2D2E30;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FFF9EA;"><tr><td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;border-radius:20px;overflow:hidden;background:#FFFFFF;">
            <tr><td style="padding:24px 28px;background:#2D2E30;color:#FFFFFF;"><div style="font-size:26px;font-weight:bold;">Arun Thai</div><div style="margin-top:7px;color:#F8C56A;font-size:11px;font-weight:bold;letter-spacing:1.5px;">PAYMENT REVIEW</div></td></tr>
            <tr><td style="padding:28px;"><h1 style="margin:0 0 12px;font-size:25px;line-height:32px;">New payment proof requires review</h1><p style="margin:0;color:#765F55;font-size:16px;line-height:25px;">A new payment proof has been submitted.</p></td></tr>
            <tr><td style="padding:0 28px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #EEE7DC;border-radius:12px;background:#FFFDF8;"><tr><td style="padding:16px 18px;color:#765F55;font-size:14px;line-height:22px;"><strong style="color:#2D2E30;">Student:</strong> ${safeStudentName}<br><strong style="color:#2D2E30;">Course:</strong> ${safeCourseTitle}<br><strong style="color:#2D2E30;">Amount:</strong> ${safeAmount}<br><strong style="color:#2D2E30;">Submitted:</strong> ${safeSubmittedAt}${paymentReferenceRow}</td></tr></table></td></tr>
            <tr><td align="center" style="padding:0 28px 32px;"><a href="${safeReviewUrl}" style="display:inline-block;border-radius:10px;background:#F8C56A;color:#2D2E30;padding:14px 22px;font-size:15px;font-weight:bold;text-decoration:none;">Review Payment</a><p style="margin:18px 0 0;color:#765F55;font-size:13px;line-height:20px;">Sign in to Arun Thai Admin to securely review the payment proof.</p></td></tr>
          </table>
        </td></tr></table>
      </body>
    </html>`;

  try {
    await sendEmail(recipient, subject, html);
    return { sent: true };
  } catch (error) {
    console.warn("Admin payment-review notification delivery failed.", {
      paymentId: String(payment._id),
      message: String(error?.message || "unknown error").slice(0, 300),
    });
    return { sent: false, reason: "delivery_failed" };
  }
}

module.exports = { sendAdminPaymentReviewNotification, formatAmount, formatSubmittedAt };
