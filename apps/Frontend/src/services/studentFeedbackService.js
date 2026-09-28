import { apiClient } from "../api/client";

export async function fetchMyStudentFeedback() {
  const response = await apiClient.get("/student-feedback/mine");
  return Array.isArray(response?.feedback) ? response.feedback : [];
}

export async function createStudentFeedback({ courseId, feedback }) {
  const response = await apiClient.post("/student-feedback", { courseId, feedback });
  return response.feedback;
}

export async function updateStudentFeedbackPublicationConsent(id, values) {
  const response = await apiClient.patch(`/student-feedback/${id}/publication-consent`, values);
  return response.feedback;
}
