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
    : null;

  return {
    id: payment._id,
    status: payment.status,
    rejectReason: payment.rejectReason || "",
    reviewedAt: payment.reviewedAt || null,
    createdAt: payment.createdAt,
    paymentImage: payment.paymentImage,
    course,
  };
}

export async function createPayment(courseId, file) {
  const formData = new FormData();
  formData.append("paymentProof", file);

  const payment = await apiClient.post(`/payments/course/${courseId}`, formData);
  return normalizePayment(payment);
}

export async function fetchMyPayments() {
  const payments = await apiClient.get("/payments/my");
  return payments.map(normalizePayment);
}
