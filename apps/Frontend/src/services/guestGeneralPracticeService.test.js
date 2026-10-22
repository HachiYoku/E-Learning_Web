import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../api/client", () => ({ API_BASE_URL: "http://localhost:3001" }))
import { fetchGuestGeneralPracticeResult, fetchGuestGeneralPracticeSession,
  startGuestGeneralPracticeSession, submitGuestGeneralPracticeQuiz } from "./guestGeneralPracticeService"

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: "session-1" }) }))
})

describe("guest General Practice API", () => {
  it("uses cookie credentials and the exact guest routes without bearer tokens or credential storage", async () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem")
    await startGuestGeneralPracticeSession("quiz/1")
    await fetchGuestGeneralPracticeSession("quiz/1", "session/1")
    await submitGuestGeneralPracticeQuiz("quiz/1", { sessionId: "session/1", revision: 2, answers: [0] })
    await fetchGuestGeneralPracticeResult("attempt/1")
    const requests = fetch.mock.calls
    expect(requests.map(([url]) => url)).toEqual([
      "http://localhost:3001/quizzes/standalone/quiz%2F1/guest/sessions",
      "http://localhost:3001/quizzes/standalone/quiz%2F1/guest/sessions/session%2F1",
      "http://localhost:3001/quizzes/standalone/quiz%2F1/guest/submit",
      "http://localhost:3001/quizzes/standalone/guest/attempts/attempt%2F1",
    ])
    for (const [, options] of requests) {
      expect(options.credentials).toBe("include")
      expect(options.headers?.Authorization).toBeUndefined()
    }
    expect(requests[0][1]).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json", "X-Guest-Quiz-Request": "1" } })
    expect(requests[1][1].method).toBe("GET")
    expect(requests[2][1].body).toBe(JSON.stringify({ sessionId: "session/1", revision: 2, answers: [0] }))
    expect(requests[3][1].method).toBe("GET")
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })

  it("preserves status, code, and Retry-After for safe UI recovery", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ code: "guest_quiz_rate_limited", message: "Later" }),
      headers: { get: () => "30" } })
    await expect(startGuestGeneralPracticeSession("quiz-1")).rejects.toMatchObject({ status: 429, code: "guest_quiz_rate_limited", retryAfter: "30" })
  })
})
