const Payment = require("../models/paymentModel");
const User = require("../models/userModel");
const ReceiptDelivery = require("../models/receiptDeliveryModel");
const { renderPaymentReceipt } = require("./paymentReceiptRenderer");
const sendEmail = require("./sendEmail");
const { randomUUID } = require("crypto");

const QUEUE_TIMEOUT_MS = 30_000;
const RENDER_DEADLINE_MS = 5 * 60 * 1000;
const MAX_DELIVERIES = 3;
let renderTail = Promise.resolve();

function receiptFilename(paymentReference) {
  return `Arun-Thai-Payment-Receipt-${paymentReference}.pdf`;
}

function safeReceiptError(message = "Receipt is temporarily unavailable. Please try again or contact support.", { status = 503, code = "receipt_temporarily_unavailable" } = {}) {
  const error = new Error(message);
  error.status = status;
  error.receiptCode = code;
  return error;
}

function runSerializedRender(receipt, { timeoutMs = QUEUE_TIMEOUT_MS } = {}) {
  let release;
  let timedOut = false;
  const previous = renderTail;
  renderTail = new Promise((resolve) => { release = resolve; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { timedOut = true; reject(safeReceiptError()); }, timeoutMs);
    previous.then(async () => {
      if (timedOut) { release(); return; }
      clearTimeout(timer);
      try { resolve(await renderPaymentReceipt(receipt)); } catch (error) { reject(error); } finally { release(); }
    });
  });
}

function paymentMethodName(payment) {
  return payment.paymentMethodSnapshot?.kind === "method" && payment.paymentMethodSnapshot?.name
    ? payment.paymentMethodSnapshot.name
    : "Payment method details unavailable";
}

function receiptDto(payment, user) {
  const courseTitle = payment.courseSnapshot?.title || payment.courseId?.title || "Course";
  return {
    studentName: user.name,
    studentEmail: user.email,
    paymentReference: payment.paymentReference,
    courseTitle,
    amount: payment.amount,
    originalAmount: payment.originalAmount ?? payment.amount,
    discountAmount: payment.discountAmount || 0,
    currency: payment.currency || payment.courseSnapshot?.currency || "THB",
    paymentMethodName: paymentMethodName(payment),
    submittedAt: payment.createdAt,
    approvedAt: payment.reviewedAt,
  };
}

async function loadEligibleReceipt(paymentId, userId = null) {
  const query = { _id: paymentId, status: "approved", paymentReference: { $type: "string" } };
  if (userId) query.userId = userId;
  const payment = await Payment.findOne(query).populate("courseId", "title").lean();
  if (!payment) return null;
  const user = await User.findById(payment.userId).select("name email role isActive").lean();
  if (!user?.email) return null;
  return { payment, user, receipt: receiptDto(payment, user) };
}

async function renderForPayment(paymentId, userId) {
  const eligible = await loadEligibleReceipt(paymentId, userId);
  if (!eligible) return null;
  const rendered = await runSerializedRender(eligible.receipt);
  return { ...eligible, ...rendered, filename: receiptFilename(eligible.payment.paymentReference) };
}

function selfServiceEmailHtml(paymentReference) {
  return `<p>Your requested payment receipt is attached to this email.</p><p>Payment Reference: ${paymentReference}</p><p>If you have questions, contact Arun Thai and include your Payment Reference.</p>`;
}

async function sendReceiptEmail({ rendered, deliveryType }) {
  if (deliveryType !== "self_service") throw new Error("Unsupported receipt email delivery type");
  const subject = `Your Arun Thai payment receipt — ${rendered.payment.paymentReference}`;
  const html = selfServiceEmailHtml(rendered.payment.paymentReference);
  await sendEmail(rendered.user.email, subject, html, [{ filename: rendered.filename, content: rendered.pdfBuffer }]);
}

function reservationIsActive(now = new Date()) {
  return {
    $or: [
      { "receiptEmailReservation.token": { $exists: false } },
      { "receiptEmailReservation.state": "rendering", "receiptEmailReservation.renderDeadlineAt": { $lte: now } },
    ],
  };
}

async function releaseReservation(paymentId, token) {
  await Payment.updateOne({ _id: paymentId, "receiptEmailReservation.token": token, "receiptEmailReservation.state": "rendering" }, { $unset: { receiptEmailReservation: 1 } });
}

// A provider's explicit rejection proves that no receipt email was accepted.
// Unlike an ambiguous network failure, this reservation can safely be removed
// after the send boundary has been crossed.
async function cancelReservation(paymentId, token) {
  await Payment.updateOne(
    { _id: paymentId, "receiptEmailReservation.token": token, "receiptEmailReservation.state": { $in: ["rendering", "sending"] } },
    { $unset: { receiptEmailReservation: 1 } },
  );
}

async function preserveUncertainReservation(paymentId, token) {
  await Payment.updateOne(
    { _id: paymentId, "receiptEmailReservation.token": token },
    { $set: { "receiptEmailReservation.state": "uncertain", "receiptEmailReservation.renderDeadlineAt": null } },
  );
}

async function reserveReceipt({ paymentId, userId = null, deliveryType, now = new Date() }) {
  const token = randomUUID();
  const query = { _id: paymentId, status: "approved", paymentReference: { $type: "string" }, ...reservationIsActive(now) };
  if (userId) query.userId = userId;
  const payment = await Payment.findOneAndUpdate(
    query,
    { $set: { receiptEmailReservation: { token, deliveryType, state: "rendering", startedAt: now, renderDeadlineAt: new Date(now.getTime() + RENDER_DEADLINE_MS) } } },
    { returnDocument: "after" },
  ).select("+receiptEmailReservation");
  if (!payment) throw safeReceiptError("A receipt request is already being processed. Please try again shortly.", { status: 409, code: "receipt_processing" });
  const deliveries = await ReceiptDelivery.countDocuments({ paymentId });
  if (deliveries >= MAX_DELIVERIES) {
    await releaseReservation(paymentId, token);
    throw safeReceiptError("Receipt email limit reached. Contact support if you need another copy.", { status: 429, code: "receipt_limit_reached" });
  }
  return { paymentId, token, deliveryType };
}

async function beginProviderSend(reservation, now = new Date()) {
  const claimed = await Payment.findOneAndUpdate(
    { _id: reservation.paymentId, "receiptEmailReservation.token": reservation.token, "receiptEmailReservation.state": "rendering", "receiptEmailReservation.renderDeadlineAt": { $gt: now } },
    { $set: { "receiptEmailReservation.state": "sending", "receiptEmailReservation.renderDeadlineAt": null } },
    { returnDocument: "after" },
  );
  if (!claimed) throw safeReceiptError();
}

async function finalizeAcceptedDelivery(reservation) {
  try {
    await ReceiptDelivery.create({ paymentId: reservation.paymentId, deliveryType: reservation.deliveryType, sentAt: new Date() });
    await Payment.updateOne({ _id: reservation.paymentId, "receiptEmailReservation.token": reservation.token }, { $unset: { receiptEmailReservation: 1 } });
  } catch (error) {
    await preserveUncertainReservation(reservation.paymentId, reservation.token);
    console.error("Receipt delivery finalization requires conservative recovery", { paymentId: String(reservation.paymentId), name: error?.name });
    throw safeReceiptError();
  }
}

async function approvalReceiptAttachment(payment) {
  if (!payment?.paymentReference) return null;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { return await renderForPayment(payment._id); } catch (error) { lastError = error; if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1000)); }
  }
  console.error("Payment receipt rendering failed", { paymentId: String(payment._id), name: lastError?.name });
  return null;
}

async function prepareApprovalReceipt(payment) {
  if (!payment?.paymentReference) return null;
  const reservation = await reserveReceipt({ paymentId: payment._id, deliveryType: "approval" });
  try {
    const attachment = await approvalReceiptAttachment(payment);
    if (!attachment) {
      await releaseReservation(payment._id, reservation.token);
      return null;
    }
    await beginProviderSend(reservation);
    return { attachment, reservation };
  } catch (error) {
    await releaseReservation(payment._id, reservation.token);
    throw error;
  }
}

async function selfServiceReceipt(paymentId, userId) {
  const reservation = await reserveReceipt({ paymentId, userId, deliveryType: "self_service" });
  let providerStarted = false;
  try {
    const rendered = await renderForPayment(paymentId, userId);
    if (!rendered) { const error = new Error("Payment receipt is not available"); error.status = 404; throw error; }
    await beginProviderSend(reservation);
    providerStarted = true;
    await sendReceiptEmail({ rendered, deliveryType: "self_service" });
    await finalizeAcceptedDelivery(reservation);
    return rendered;
  } catch (error) {
    if (!providerStarted) await releaseReservation(paymentId, reservation.token);
    else if (error?.definitiveProviderFailure) await cancelReservation(paymentId, reservation.token);
    else {
      await preserveUncertainReservation(paymentId, reservation.token);
      throw safeReceiptError("Receipt delivery is temporarily being confirmed. Please contact support before trying again.", { status: 503, code: "receipt_uncertain" });
    }
    throw error;
  }
}

module.exports = {
  QUEUE_TIMEOUT_MS, RENDER_DEADLINE_MS, MAX_DELIVERIES,
  approvalReceiptAttachment, loadEligibleReceipt, receiptDto, receiptFilename,
  renderForPayment, runSerializedRender, selfServiceReceipt, sendReceiptEmail,
  reserveReceipt, beginProviderSend, finalizeAcceptedDelivery, releaseReservation, cancelReservation, preserveUncertainReservation, reservationIsActive, prepareApprovalReceipt,
};
