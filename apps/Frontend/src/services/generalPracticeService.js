import { apiClient } from "../api/client"

export async function fetchGeneralPracticeQuizzes() {
  const response = await apiClient.get("/quizzes/standalone")
  return response.quizzes
}

export function fetchGeneralPracticeQuiz(quizId) {
  return apiClient.get(`/quizzes/standalone/${encodeURIComponent(quizId)}`)
}

export function startGeneralPracticeSession(quizId) {
  return apiClient.post(`/quizzes/standalone/${encodeURIComponent(quizId)}/sessions`, {})
}

export function submitGeneralPracticeQuiz(quizId, submission) {
  return apiClient.post(`/quizzes/standalone/${encodeURIComponent(quizId)}/submit`, submission)
}

export function fetchGeneralPracticeResult(attemptId) {
  return apiClient.get(`/quizzes/standalone/attempts/${encodeURIComponent(attemptId)}`)
}
