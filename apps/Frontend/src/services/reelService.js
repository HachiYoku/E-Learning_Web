import { apiClient } from "../api/client";

export async function fetchReels() {
  const response = await apiClient.get("/reels");
  return Array.isArray(response?.reels) ? response.reels : [];
}
