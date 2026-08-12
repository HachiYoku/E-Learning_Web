import { apiClient } from "../api/client";

export function getNotifications() {
  return apiClient.get("/notifications");
}

export function markNotificationRead(notificationId) {
  return apiClient.patch(`/notifications/${notificationId}/read`, {});
}

export function markAllNotificationsRead() {
  return apiClient.patch("/notifications/read-all", {});
}
