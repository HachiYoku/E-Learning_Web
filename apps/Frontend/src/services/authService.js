import { apiClient } from "../api/client";

export function login(payload) {
  return apiClient.post("/auth/login", payload);
}

export function register(payload) {
  return apiClient.post("/auth/register", payload);
}

export function resendVerification(payload) {
  return apiClient.post("/auth/resend-verification", payload);
}

export function forgotPassword(payload) {
  return apiClient.post("/auth/forgot-password", payload);
}

export function resetPassword(token, payload) {
  return apiClient.post(`/auth/reset-password/${token}`, payload);
}

export function getCurrentUser() {
  return apiClient.get("/auth/me");
}

export function updateProfile(payload) {
  if (payload instanceof FormData) {
    return apiClient.put("/user", payload);
  }

  const formData = new FormData();

  if (payload?.name) {
    formData.append("name", payload.name);
  }

  if (payload?.avatarFile) {
    formData.append("avatar", payload.avatarFile);
  }

  return apiClient.put("/user", formData);
}
