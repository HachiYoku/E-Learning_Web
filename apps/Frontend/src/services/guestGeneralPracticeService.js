import { API_BASE_URL } from "../api/client"

async function guestRequest(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : {
      "Content-Type": "application/json",
      "X-Guest-Quiz-Request": "1",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.message || "Guest quiz request could not be completed.")
    error.status = response.status
    error.code = data?.code
    error.retryAfter = response.headers.get("Retry-After")
    throw error
  }
  return data
}

const quizPath = (quizId) => `/quizzes/standalone/${encodeURIComponent(quizId)}/guest`

export const startGuestGeneralPracticeSession = (quizId) => guestRequest(`${quizPath(quizId)}/sessions`, {})
export const fetchGuestGeneralPracticeSession = (quizId, sessionId) =>
  guestRequest(`${quizPath(quizId)}/sessions/${encodeURIComponent(sessionId)}`)
export const submitGuestGeneralPracticeQuiz = (quizId, submission) =>
  guestRequest(`${quizPath(quizId)}/submit`, submission)
export const fetchGuestGeneralPracticeResult = (attemptId) =>
  guestRequest(`/quizzes/standalone/guest/attempts/${encodeURIComponent(attemptId)}`)
