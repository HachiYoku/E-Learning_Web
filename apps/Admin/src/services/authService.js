import { apiClient } from "../api/client";

export function login(payload) {
  return apiClient.post("/auth/login", payload);
}

export function getCurrentUser() {
  return apiClient.get("/auth/me");
}

export function updateCurrentUserProfile(payload) {
  const formData = new FormData();

  if (payload.name) {
    formData.append("name", payload.name);
  }

  if (payload.avatarFile) {
    formData.append("avatar", payload.avatarFile);
  }

  return apiClient.put("/user", formData);
}
