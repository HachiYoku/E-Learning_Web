import { apiClient } from "../api/client";
export const validatePromoCode = (code, courseId) => apiClient.post("/promo-codes/validate", { code, courseId });
