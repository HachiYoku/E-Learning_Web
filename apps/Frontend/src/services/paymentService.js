import { apiClient } from "../api/client";

function normalizePayment(payment) {
  if (!payment) {
    return null;
  }

  const course = payment.courseId
    ? {
        id: payment.courseId._id,
        title: payment.courseId.title,
        description: payment.courseId.description || "",
        price: `${Number(payment.courseId.price || 0).toLocaleString()} ฿`,
        priceValue: Number(payment.courseId.price || 0),
        image: payment.courseId.thumbnail || "",
      }
    : {
        id: null,
        title: payment.courseSnapshot?.title || "Removed course",
        description: payment.courseSnapshot?.description || "This course is no longer available.",
        price: `${Number(payment.courseSnapshot?.price ?? payment.originalAmount ?? payment.amount ?? 0).toLocaleString()} ฿`,
        priceValue: Number(payment.courseSnapshot?.price ?? payment.originalAmount ?? payment.amount ?? 0),
        image: payment.courseSnapshot?.thumbnail || "",
      };

  return {
    id: payment._id,
    status: payment.status,
    rejectReason: payment.rejectReason || "",
    reviewedAt: payment.reviewedAt || null,
    createdAt: payment.createdAt,
    courseUnavailable: Boolean(payment.courseDeletedAt || !payment.courseId),
    hasPaymentProof: Boolean(payment.hasPaymentProof),
    course,
  };
}

export async function createPayment(courseId, file, promoCode = "") {
  const formData = new FormData();
  formData.append("paymentProof", file);
  if (promoCode) formData.append("promoCode", promoCode);

  const payment = await apiClient.post(`/payments/course/${courseId}`, formData);
  return normalizePayment(payment);
}

export async function fetchMyPayments() {
  const payments = await apiClient.get("/payments/my");
  return payments.map(normalizePayment);
}
