import { apiClient } from "../api/client";

export function fetchContactLeads() {
  return apiClient.get("/contacts");
}
