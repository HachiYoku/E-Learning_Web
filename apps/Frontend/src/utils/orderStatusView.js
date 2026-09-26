import { formatSavedPaymentAmount } from "./paymentDisplay.js";

export function savedPaymentDetails(payment) {
  const currency = payment?.currency || payment?.paymentMethod?.currency || "THB";
  const amount = payment?.amount ?? payment?.course?.priceValue;
  return {
    amount: amount == null ? "Amount unavailable" : formatSavedPaymentAmount(amount, currency),
    currency,
    method: payment?.paymentMethod?.name || "Payment method not recorded",
  };
}

export function orderStatusView(payment) {
  if (payment?.status === "approved") return {
    kind: "approved", eyebrow: "Enrollment complete", title: "Enrollment complete",
    description: "Your payment was approved and you now have access to this course.",
    action: "Start learning", steps: ["complete", "complete", "complete"],
  };
  if (payment?.status === "rejected") return {
    kind: "rejected", eyebrow: "Action needed", title: "Payment needs attention",
    description: "We couldn't approve this payment.", action: "Submit a new payment", steps: null,
  };
  return {
    kind: "pending", eyebrow: "Payment status", title: "Waiting for review",
    description: "Your payment was submitted successfully. No action is needed while our team verifies it.",
    action: null, steps: ["complete", "active", "upcoming"],
  };
}

export const rejectedPaymentResubmissionPath = (courseId) => `/payment/${courseId}`;
