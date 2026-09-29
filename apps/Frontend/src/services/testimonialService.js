import { apiClient } from "../api/client";

export async function fetchTestimonials(limit) {
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  const response = await apiClient.get(`/testimonials${query}`);
  return Array.isArray(response?.testimonials) ? response.testimonials : [];
}
