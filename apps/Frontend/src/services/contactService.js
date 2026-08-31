import { apiClient } from "../api/client";

export function submitContactLead(values) {
  return apiClient.post("/contacts", values);
}
