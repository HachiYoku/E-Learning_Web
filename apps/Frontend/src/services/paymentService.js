import { apiClient } from "../api/client";
import { formatSavedPaymentAmount } from "../utils/paymentDisplay";

function normalizePayment(payment) {
  if (!payment) {
    return null;
  }

  const currency = payment.currency || payment.courseSnapshot?.currency || "THB";
  const savedPrice = payment.amount ?? payment.courseSnapshot?.price ?? payment.originalAmount;
  const course = {
    id: payment.courseId?._id || null,
    title: payment.courseSnapshot?.title || payment.courseId?.title || "Removed course",
    description: payment.courseSnapshot?.description || payment.courseId?.description || "This course is no longer available.",
    price: savedPrice == null ? "Amount unavailable" : formatSavedPaymentAmount(savedPrice, currency),
    priceValue: savedPrice == null ? null : Number(savedPrice),
    image: payment.courseSnapshot?.thumbnail || payment.courseId?.thumbnail || "",
  };

  return {
    id: payment._id,
    status: payment.status,
    rejectReason: payment.rejectReason || "",
    reviewedAt: payment.reviewedAt || null,
    createdAt: payment.createdAt,
    courseUnavailable: Boolean(payment.courseDeletedAt || !payment.courseId),
    hasPaymentProof: Boolean(payment.hasPaymentProof),
    currency: payment.currency || null,
    amount: payment.amount ?? null,
    paymentMethod: payment.paymentMethodSnapshot?.kind === "method" ? payment.paymentMethodSnapshot : null,
    course,
  };
}

export async function createPayment(courseId, file, paymentMethodId, promoCode = "", quote = null) {
  const formData = new FormData();
  formData.append("paymentProof", file);
  formData.append("paymentMethodId", paymentMethodId);
  formData.append("courseMutationVersion", String(quote?.coursePrice?.mutationVersion));
  formData.append("paymentMethodMutationVersion", String(quote?.paymentMethod?.mutationVersion));
  if (promoCode) formData.append("promoCode", promoCode);

  const payment = await apiClient.post(`/payments/course/${courseId}`, formData);
  return normalizePayment(payment);
}

export const fetchPaymentMethods = (courseId) => apiClient.get(`/payments/course/${courseId}/methods`);
export const quotePayment = (courseId, paymentMethodId, promoCode = "") => apiClient.post(`/payments/course/${courseId}/quote`, { paymentMethodId, promoCode });
export const fetchRejectedPaymentProofBlob = (paymentId) => apiClient.getBlob(`/payments/${paymentId}/student-proof`);

export async function fetchMyPayments() {
  const payments = await apiClient.get("/payments/my");
  return payments.map(normalizePayment);
}
