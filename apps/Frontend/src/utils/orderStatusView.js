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
  const derived = payment?.coursePaymentState;
  if (payment?.status === "rejected" && derived?.kind === "enrolled") return {
    kind: "resolved", eyebrow: "Payment issue resolved", title: "Payment issue resolved",
    description: "Your updated payment was approved. You now have access to this course.", action: "Start learning", steps: null,
  };
  if (payment?.status === "rejected" && derived?.kind === "newer_pending") return {
    kind: "newer_pending", eyebrow: "New payment submitted", title: "New payment submitted",
    description: "We’ve received your updated payment and it’s waiting for review.", action: "View latest payment", currentPaymentId: derived.currentPaymentId, steps: null,
  };
  if (payment?.status === "rejected" && derived?.kind === "newer_rejected") return {
    kind: "newer_rejected", eyebrow: "Newer payment needs attention", title: "A newer payment needs attention",
    description: "Please review your latest payment attempt.", action: "View latest payment", currentPaymentId: derived.currentPaymentId, steps: null,
  };
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
