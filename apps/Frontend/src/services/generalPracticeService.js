import { apiClient } from "../api/client"

export async function fetchGeneralPracticeQuizzes() {
  const response = await apiClient.get("/quizzes/standalone")
  return response.quizzes
}

export function fetchGeneralPracticeQuiz(quizId) {
  return apiClient.get(`/quizzes/standalone/${encodeURIComponent(quizId)}`)
}
