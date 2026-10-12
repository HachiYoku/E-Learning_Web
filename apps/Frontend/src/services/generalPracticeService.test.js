import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))

import { apiClient } from "../api/client"
import { fetchGeneralPracticeQuizzes, fetchGeneralPracticeQuiz, startGeneralPracticeSession, submitGeneralPracticeQuiz, fetchGeneralPracticeResult, fetchGeneralPracticeHistory } from "./generalPracticeService"

beforeEach(() => vi.resetAllMocks())

describe("General Practice metadata API", () => {
  it("loads the published listing from the standalone endpoint", async () => {
    apiClient.get.mockResolvedValue({ quizzes: [{ id: "quiz-1" }] })
    expect(await fetchGeneralPracticeQuizzes()).toEqual([{ id: "quiz-1" }])
    expect(apiClient.get).toHaveBeenCalledWith("/quizzes/standalone")
  })

  it("loads details with an encoded identifier", async () => {
    apiClient.get.mockResolvedValue({ id: "quiz-1" })
    await fetchGeneralPracticeQuiz("quiz/1")
    expect(apiClient.get).toHaveBeenCalledWith("/quizzes/standalone/quiz%2F1")
  })

  it("uses the exact session and submission routes and preserves their payloads", async () => {
    apiClient.post.mockResolvedValueOnce({ sessionId: "session-1" }).mockResolvedValueOnce({ attemptId: "attempt-1" })
    await startGeneralPracticeSession("quiz-1")
    const payload = { sessionId: "session-1", revision: 2, answers: [0, 1] }
    await submitGeneralPracticeQuiz("quiz-1", payload)
    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/quizzes/standalone/quiz-1/sessions", {})
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/quizzes/standalone/quiz-1/submit", payload)
  })

  it("retrieves a saved attempt by its owner-scoped result endpoint", async () => {
    apiClient.get.mockResolvedValue({ attemptId: "attempt-1" })
    await fetchGeneralPracticeResult("attempt-1")
    expect(apiClient.get).toHaveBeenCalledWith("/quizzes/standalone/attempts/attempt-1")
  })

  it("loads owner-scoped history with an encoded cursor", async () => {
    apiClient.get.mockResolvedValue({ attempts: [], pageSize: 10, nextCursor: null })
    await fetchGeneralPracticeHistory("quiz/1")
    await fetchGeneralPracticeHistory("quiz/1", "12/3")
    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/quizzes/standalone/quiz%2F1/attempts")
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/quizzes/standalone/quiz%2F1/attempts?before=12%2F3")
  })
})
