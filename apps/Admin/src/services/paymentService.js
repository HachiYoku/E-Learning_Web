import { apiClient } from "../api/client";

function normalizePayment(payment) {
  if (!payment) {
    return null;
  }

  return {
    id: payment._id,
    userName: payment.userId?.name || "Unknown user",
    userEmail: payment.userId?.email || "",
    userAvatar:
      payment.userId?.avatar ||
      `https://ui-avatars.com/api/?background=f8b2c0&color=111827&name=${encodeURIComponent(payment.userId?.name || "User")}`,
    userDate: payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "",
    courseName: payment.courseId?.title || "Unknown course",
    coursePrice: `${Number(payment.courseId?.price || 0).toLocaleString()} บาท`,
    amount: `${Number(payment.courseId?.price || 0).toLocaleString()} ฿`,
    date: payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "",
    paymentMethod: "Uploaded transfer slip",
    cardInfo: payment.userId?.email || "",
    status: payment.status,
    denialReason: payment.rejectReason || "",
    paymentImage: payment.paymentImage || "",
  };
}

export async function fetchAllPayments() {
  const payments = await apiClient.get("/payments");
  return payments.map(normalizePayment);
}

export async function approvePayment(paymentId) {
  return apiClient.patch(`/payments/${paymentId}/approve`, {});
}

export async function rejectPayment(paymentId, rejectReason) {
  return apiClient.patch(`/payments/${paymentId}/reject`, { rejectReason });
}
