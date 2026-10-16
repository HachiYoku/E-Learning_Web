import { apiClient } from "../api/client"

export function fetchGeneralPracticeSets({ name = "", difficulty = "", after } = {}) {
  const params = new URLSearchParams()
  if (name) params.set("name", name)
  if (difficulty) params.set("difficulty", difficulty)
  if (after) params.set("after", after)
  const query = params.toString()
  return apiClient.get(`/quizzes/standalone/sets${query ? `?${query}` : ""}`)
}

export function fetchGeneralPracticeSet(setId) {
  return apiClient.get(`/quizzes/standalone/sets/${encodeURIComponent(setId)}`)
}

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

export function fetchGeneralPracticeHistory(quizId, before) {
  const cursor = before ? `?before=${encodeURIComponent(before)}` : ""
  return apiClient.get(`/quizzes/standalone/${encodeURIComponent(quizId)}/attempts${cursor}`)
}
