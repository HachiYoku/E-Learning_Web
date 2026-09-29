import { apiClient } from "../api/client";

const formDataFor = (payload) => {
  const form = new FormData();
  for (const key of ["name", "currency", "type", "provider", "instructions", "adminPassword"]) form.append(key, payload[key] || "");
  form.append("isActive", String(payload.isActive !== false));
  form.append("recipient", JSON.stringify(payload.recipient || {}));
  if (payload.qrImageFile) form.append("qrImage", payload.qrImageFile);
  return form;
};
export const fetchPaymentMethods = () => apiClient.get("/payment-methods/admin");
export const createPaymentMethod = (payload) => apiClient.post("/payment-methods/admin", formDataFor(payload));
export const updatePaymentMethod = (id, payload) => apiClient.put(`/payment-methods/admin/${id}`, formDataFor(payload));
export const setPaymentMethodActive = (id, isActive, adminPassword) => apiClient.patch(`/payment-methods/admin/${id}/active`, { isActive, adminPassword });
export const deletePaymentMethod = (id, adminPassword) => apiClient.delete(`/payment-methods/admin/${id}`, { adminPassword });
