import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../api/client", () => ({ apiClient: { get: vi.fn() } }))

import { apiClient } from "../api/client"
import { fetchGeneralPracticeQuizzes, fetchGeneralPracticeQuiz } from "./generalPracticeService"

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
})
