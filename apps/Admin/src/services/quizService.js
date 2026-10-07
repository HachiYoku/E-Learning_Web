import { apiClient } from "../api/client";

const normalizeQuiz = (quiz) => ({
  id: quiz._id,
  title: quiz.title,
  maxAttempts: quiz.maxAttempts ?? null,
  course: quiz.course,
  lesson: quiz.lesson,
  quizType: quiz.quizType || "lesson",
  status: quiz.status || "draft",
  attemptCount: quiz.attemptCount || 0,
  questions: quiz.questions || [],
  createdAt: quiz.createdAt,
});

function buildQuizFormData(payload) {
  const formData = new FormData();
  formData.append("courseId", payload.courseId);
  if (payload.lessonId) formData.append("lessonId", payload.lessonId);
  formData.append("title", payload.title.trim());
  formData.append("quizType", payload.quizType || "lesson");
  formData.append("maxAttempts", payload.maxAttempts === null || payload.maxAttempts === "" ? "" : String(payload.maxAttempts));
  formData.append("questions", JSON.stringify(payload.questions.map(({ imageFile, audioFile, preview, audioPreview, ...question }) => question)));
  if (payload.confirmHistoryChange) formData.append("confirmHistoryChange", "true");
  if (payload.confirmScoringChange) formData.append("confirmScoringChange", "true");
  payload.questions.forEach((question, index) => {
    if (question.imageFile) formData.append(`questionImage_${index}`, question.imageFile);
    if (question.audioFile) formData.append(`questionAudio_${index}`, question.audioFile);
  });
  return formData;
}

export async function fetchQuizzes() {
  return (await apiClient.get("/quizzes/admin")).map(normalizeQuiz);
}

export async function fetchQuiz(id) {
  return normalizeQuiz(await apiClient.get(`/quizzes/admin/${id}`));
}

export async function createQuiz(payload) {
  return normalizeQuiz(await apiClient.post("/quizzes/admin", buildQuizFormData(payload)));
}

export async function updateQuiz(id, payload) {
  return normalizeQuiz(await apiClient.put(`/quizzes/admin/${id}`, buildQuizFormData(payload)));
}

export async function updateQuizQuestion(quizId, questionId, question, confirmations = {}) {
  const formData = new FormData();
  const { imageFile, audioFile, preview, audioPreview, ...serializable } = question;
  formData.append("question", JSON.stringify(serializable));
  if (imageFile) formData.append("questionImage_0", imageFile);
  if (audioFile) formData.append("questionAudio_0", audioFile);
  if (confirmations.confirmHistoryChange) formData.append("confirmHistoryChange", "true");
  if (confirmations.confirmScoringChange) formData.append("confirmScoringChange", "true");
  return apiClient.put(`/quizzes/admin/${quizId}/questions/${questionId}`, formData);
}

export async function createQuizQuestion(quizId, question, confirmations = {}) {
  const formData = new FormData();
  const { imageFile, audioFile, preview, audioPreview, localId, ...serializable } = question;
  formData.append("question", JSON.stringify(serializable));
  if (imageFile) formData.append("questionImage_0", imageFile);
  if (audioFile) formData.append("questionAudio_0", audioFile);
  if (confirmations.confirmHistoryChange) formData.append("confirmHistoryChange", "true");
  if (confirmations.confirmScoringChange) formData.append("confirmScoringChange", "true");
  return apiClient.post(`/quizzes/admin/${quizId}/questions`, formData);
}

export async function deleteQuiz(id) {
  return apiClient.delete(`/quizzes/admin/${id}`);
}

export async function archiveQuiz(id) {
  return apiClient.post(`/quizzes/admin/${id}/archive`);
}

export async function restoreQuiz(id) {
  return apiClient.post(`/quizzes/admin/${id}/restore`);
}

export async function changeQuizAvailability(id, status) {
  return apiClient.post(`/quizzes/admin/${id}/availability`, { status });
}

export function fetchQuizAttempts(id) {
  return apiClient.get(`/quizzes/admin/${id}/attempts`);
}

export function grantQuizAttempt(id, studentId, reason = "") {
  return apiClient.post(`/quizzes/admin/${id}/attempt-grants`, { studentId, reason });
}

export function reviewQuizAttemptRequest(quizId, requestId, decision, note = "") {
  return apiClient.post(`/quizzes/admin/${quizId}/attempt-requests/${requestId}/review`, { decision, note });
}
