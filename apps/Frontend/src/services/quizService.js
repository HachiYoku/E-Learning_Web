import { apiClient } from "../api/client";

export function fetchQuizzesForLesson(courseId, lessonId) {
  return apiClient.get(`/quizzes/course/${courseId}/lesson/${lessonId}`);
}

export function submitQuiz(quizId, answers) {
  return apiClient.post(`/quizzes/${quizId}/submit`, { answers });
}
