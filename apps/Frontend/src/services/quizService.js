import { apiClient } from "../api/client";

const normalizeQuiz = (quiz) => ({
  ...quiz,
  id: quiz.id || quiz._id,
  _id: quiz._id || quiz.id,
});

export function fetchQuizzesForLesson(courseId, lessonId) {
  return apiClient.get(`/quizzes/course/${courseId}/lesson/${lessonId}`).then((items) => items.map(normalizeQuiz));
}

export function fetchCourseQuizzes(courseId) {
  return apiClient.get(`/quizzes/course/${courseId}`).then((items) => items.map(normalizeQuiz));
}

export function startQuizSession(quizId) {
  return apiClient.post(`/quizzes/${quizId}/sessions`, {});
}

export function submitQuiz(quizId, answers, revision, sessionId) {
  return apiClient.post(`/quizzes/${quizId}/submit`, { answers, revision, sessionId });
}

export function fetchQuizHistory(quizId) {
  return apiClient.get(`/quizzes/${quizId}/history`);
}

export function fetchQuizAttemptRequests(quizId) {
  return apiClient.get(`/quizzes/${quizId}/attempt-requests`);
}

export function createQuizAttemptRequest(quizId, reason) {
  return apiClient.post(`/quizzes/${quizId}/attempt-requests`, { reason });
}

export function cancelQuizAttemptRequest(quizId, requestId) {
  return apiClient.patch(`/quizzes/${quizId}/attempt-requests/${requestId}/cancel`);
}
