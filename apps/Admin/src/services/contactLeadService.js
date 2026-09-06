import { apiClient } from "../api/client";

export function fetchContactLeads() {
  return apiClient.get("/contacts");
}

export function fetchUnreadContactLeadCount() {
  return apiClient.get("/contacts/unread-count");
}
