import { apiClient } from "../api/client";
export { formatPaymentAmount, normalizePayment } from "./paymentDisplay";
import { normalizePayment } from "./paymentDisplay";

export async function fetchAllPayments() {
  const payments = await apiClient.get("/payments");
  return payments.map(normalizePayment);
}

export function fetchPendingPaymentCount() {
  return apiClient.get("/payments/pending-count");
}

export function fetchPaymentProofAccess(paymentId) {
  return apiClient.get(`/payments/${paymentId}/proof-access`);
}

export async function fetchPaymentProofBlob(paymentId) {
  const access = await fetchPaymentProofAccess(paymentId);
  const response = await fetch(access.url, { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || "Unable to load the secure payment proof.");
  }
  return URL.createObjectURL(await response.blob());
}

export async function approvePayment(paymentId, adminPassword) {
  return apiClient.patch(`/payments/${paymentId}/approve`, { adminPassword });
}

export async function rejectPayment(paymentId, rejectReason, adminPassword) {
  return apiClient.patch(`/payments/${paymentId}/reject`, { rejectReason, adminPassword });
}
