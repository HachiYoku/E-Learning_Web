import { apiClient } from "../api/client";

export function normalizeReel(reel) {
  if (!reel) return null;
  return {
    id: reel._id || reel.id,
    url: reel.url || "",
    platform: reel.platform || "",
    isActive: reel.isActive === true,
    displayOrder: Number.isInteger(reel.displayOrder) ? reel.displayOrder : 0,
  };
}

export async function fetchAdminReels() {
  const reels = await apiClient.get("/reels/admin");
  return Array.isArray(reels) ? reels.map(normalizeReel) : [];
}

export const createReel = async (payload) => normalizeReel(await apiClient.post("/reels/admin", payload));
export const updateReel = async (id, payload) => normalizeReel(await apiClient.put(`/reels/admin/${id}`, payload));
export const deleteReel = (id) => apiClient.delete(`/reels/admin/${id}`);
