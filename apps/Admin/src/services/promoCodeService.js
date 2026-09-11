import { apiClient } from "../api/client";
export const fetchPromoCodes = () => apiClient.get("/promo-codes/admin");
export const createPromoCode = (data, adminPassword) => apiClient.post("/promo-codes/admin", { ...data, adminPassword });
export const updatePromoCode = (id, data) => apiClient.put(`/promo-codes/admin/${id}`, data);
export const deletePromoCode = (id) => apiClient.delete(`/promo-codes/admin/${id}`);
