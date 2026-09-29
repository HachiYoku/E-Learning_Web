import { apiClient } from "../api/client";

export function fetchAdminStudentFeedback({ status = "awaiting_review", page = 1, limit = 20, courseId } = {}) {
  const params = new URLSearchParams({ status, page: String(page), limit: String(limit) });
  if (courseId) params.set("courseId", courseId);
  return apiClient.get(`/admin/student-feedback?${params.toString()}`);
}

export const fetchAdminStudentFeedbackDetail = (id) => apiClient.get(`/admin/student-feedback/${id}`);
export const updateAdminStudentFeedbackPublication = (id, status) => apiClient.patch(`/admin/student-feedback/${id}/publication`, { status });
