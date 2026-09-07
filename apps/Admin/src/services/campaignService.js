import { apiClient } from "../api/client";

export function fetchCampaigns() {
  return apiClient.get("/campaigns");
}

export function createCampaign({ subject, message, recipientIds, imageFile }) {
  const formData = new FormData();
  formData.append("subject", subject);
  formData.append("message", message);
  formData.append("recipientIds", JSON.stringify(recipientIds));
  if (imageFile) formData.append("image", imageFile);
  return apiClient.post("/campaigns", formData);
}

export function sendCampaign(id) {
  return apiClient.post(`/campaigns/${id}/send`, {});
}

export function sendUserAnnouncement({ title, message, link, type }) {
  return apiClient.post("/notifications/broadcast", { title, message, link, type });
}

export function fetchAnnouncements() {
  return apiClient.get("/notifications/announcements");
}

export function deleteAnnouncement(id) {
  return apiClient.delete(`/notifications/announcements/${id}`);
}

export function deleteDraftCampaign(id) {
  return apiClient.delete(`/campaigns/${id}`);
}

export function updateDraftCampaign(id, { subject, message, recipientIds, imageFile }) {
  const formData = new FormData();
  formData.append("subject", subject);
  formData.append("message", message);
  formData.append("recipientIds", JSON.stringify(recipientIds));
  if (imageFile) formData.append("image", imageFile);
  return apiClient.put(`/campaigns/${id}`, formData);
}
