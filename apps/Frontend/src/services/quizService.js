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

export function submitQuiz(quizId, answers) {
  return apiClient.post(`/quizzes/${quizId}/submit`, { answers });
}

export function fetchQuizHistory(quizId) {
  return apiClient.get(`/quizzes/${quizId}/history`);
}
