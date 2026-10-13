import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import GeneralPracticeComplete from "./GeneralPracticeComplete"
import GeneralPracticeHistory from "./GeneralPracticeHistory"

vi.mock("../services/generalPracticeService", () => ({
  fetchGeneralPracticeResult: vi.fn(),
  fetchGeneralPracticeHistory: vi.fn(),
  fetchGeneralPracticeQuiz: vi.fn(),
  startGeneralPracticeSession: vi.fn(),
}))

import { fetchGeneralPracticeResult, fetchGeneralPracticeHistory, fetchGeneralPracticeQuiz, startGeneralPracticeSession } from "../services/generalPracticeService"

const quizId = "6acc46dbad4ace5e3d908d2c"
const attemptId = "6acc46dbad4ace5e3d908d2d"
const result = {
  attemptId, quizId, attemptNumber: 2, title: "Thai greetings", revision: 1,
  completedAt: "2026-10-12T12:00:00.000Z", score: 1, total: 3, percentage: 33.333,
  correctCount: 1, incorrectCount: 2, answers: [0, 1, null],
  review: [
    { questionId: "q1", prompt: "Say hello", options: ["สวัสดี", "ขอบคุณ"], selectedAnswer: 0, correctAnswer: 0, isCorrect: true, explanation: "A greeting.", image: "https://example.test/hello.png", imageAlt: "A greeting", imageDecorative: false },
    { questionId: "q2", prompt: "Say thanks", options: ["สวัสดี", "ขอบคุณ"], selectedAnswer: 0, correctAnswer: 1, isCorrect: false, audio: "https://example.test/thanks.mp3", audioLabel: "Listen to thanks" },
    { questionId: "q3", prompt: "Say goodbye", options: ["ลาก่อน", "สวัสดี"], selectedAnswer: null, correctAnswer: 0, isCorrect: false },
  ],
}

function SessionDestination() {
  const location = useLocation()
  return <div>Session destination: {location.state?.session?.sessionId}, {String(location.state?.session?.created)}</div>
}

function renderRoutes(path, state = null) {
  return render(<MemoryRouter initialEntries={[{ pathname: path, state }]}><Routes>
    <Route path="/app/practice/general/:quizId/complete/:attemptId" element={<GeneralPracticeComplete />} />
    <Route path="/app/practice/general/:quizId/history" element={<GeneralPracticeHistory />} />
    <Route path="/app/practice/general/:quizId/take" element={<SessionDestination />} />
  </Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchGeneralPracticeResult.mockResolvedValue(result)
  fetchGeneralPracticeHistory.mockResolvedValue({ attempts: [], pageSize: 10, nextCursor: null })
  fetchGeneralPracticeQuiz.mockResolvedValue({ title: "Thai greetings" })
  startGeneralPracticeSession.mockResolvedValue({ sessionId: "new-session", created: true })
})

describe("General Practice saved results", () => {
  it("renders the Backend score and ordered saved answer snapshot with accessible statuses and media", async () => {
    renderRoutes(`/app/practice/general/${quizId}/complete/${attemptId}`)
    expect(await screen.findByRole("heading", { name: "Thai greetings" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Thai greetings" })).toBeTruthy()
    expect(screen.getByRole("status", { name: "Score: 1 out of 3" })).toBeTruthy()
    expect(screen.getByText("33% correct")).toBeTruthy()
    expect(screen.getByAltText("A greeting")).toBeTruthy()
    expect(screen.getByLabelText("Listen to thanks")).toBeTruthy()
    const review = screen.getByRole("region", { name: "Review your answers" })
    expect(within(review).getAllByRole("list", { name: /Saved answer options/ })).toHaveLength(3)
    expect(within(review).getByLabelText("Question 1: Correct")).toBeTruthy()
    expect(within(review).getByLabelText("Question 2: Incorrect")).toBeTruthy()
    expect(within(review).getByLabelText("Question 3: Unanswered")).toBeTruthy()
    expect(within(review).getByText("No answer submitted.")).toBeTruthy()
    expect(within(review).getAllByText("Your answer · Incorrect")).toHaveLength(1)
    expect(within(review).getAllByText("Correct answer")).toHaveLength(2)
    expect(within(review).getAllByText("สวัสดี")).toHaveLength(3)
    expect(screen.queryByRole("link", { name: "Review answers" })).toBeNull()
    expect(screen.queryByText(/Attempt reference:/)).toBeNull()
    expect(within(review).getByText("A greeting.")).toBeTruthy()
    expect(fetchGeneralPracticeResult).toHaveBeenCalledWith(attemptId)
  })

  it("verifies a direct result URL before showing the saved score", async () => {
    let resolveResult
    fetchGeneralPracticeResult.mockImplementation(() => new Promise((resolve) => { resolveResult = resolve }))
    renderRoutes(`/app/practice/general/${quizId}/complete/${attemptId}`)
    expect(screen.queryByText("33% correct")).toBeNull()
    await act(async () => resolveResult(result))
    expect(await screen.findByText("33% correct")).toBeTruthy()
  })

  it.each([true, false])("starts a %s retake only on request and passes the returned session to taking", async (created) => {
    let resolveStart
    startGeneralPracticeSession.mockImplementation(() => new Promise((resolve) => { resolveStart = resolve }))
    renderRoutes(`/app/practice/general/${quizId}/complete/${attemptId}`)
    await screen.findByRole("heading", { name: "Thai greetings" })
    expect(startGeneralPracticeSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }))
    fireEvent.click(screen.getByRole("button", { name: "Opening quiz..." }))
    expect(startGeneralPracticeSession).toHaveBeenCalledTimes(1)
    await act(async () => resolveStart({ sessionId: "new-session", created }))
    expect(await screen.findByText(`Session destination: new-session, ${created}`)).toBeTruthy()
  })

  it("keeps the saved result visible when a retake is unavailable or rate-limited", async () => {
    startGeneralPracticeSession.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error("Limited"), { status: 429, retryAfter: "15" }))
    const user = userEvent.setup()
    renderRoutes(`/app/practice/general/${quizId}/complete/${attemptId}`)
    await screen.findByRole("heading", { name: "Thai greetings" })
    await user.click(screen.getByRole("button", { name: "Try Again" }))
    expect((await screen.findByRole("alert")).textContent).toContain("no longer available")
    expect(screen.getByText("33% correct")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Try Again" }))
    expect((await screen.findByRole("alert")).textContent).toContain("15 seconds")
  })
})

describe("General Practice personal history", () => {
  it("loads newest first, uses nextCursor, and removes duplicate attempts from later pages", async () => {
    fetchGeneralPracticeHistory.mockResolvedValueOnce({ attempts: [
      { attemptId: "a3", quizId, attemptNumber: 3, title: "Thai greetings", score: 2, total: 3, percentage: 66.7 },
      { attemptId: "a2", quizId, attemptNumber: 2, title: "Thai greetings", score: 1, total: 3, percentage: 33.3 },
    ], pageSize: 2, nextCursor: "2" }).mockResolvedValueOnce({ attempts: [
      { attemptId: "a2", quizId, attemptNumber: 2, title: "Thai greetings", score: 1, total: 3, percentage: 33.3 },
      { attemptId: "a1", quizId, attemptNumber: 1, title: "Thai greetings", score: 3, total: 3, percentage: 100 },
    ], pageSize: 2, nextCursor: null })
    const user = userEvent.setup()
    renderRoutes(`/app/practice/general/${quizId}/history`)
    expect(await screen.findByText("Attempt 3")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Thai greetings" })).toBeTruthy()
    expect(screen.getAllByText("Thai greetings")).toHaveLength(1)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByRole("list").className).toContain("space-y-3")
    expect(screen.getByRole("list").className).not.toContain("grid-cols-2")
    await user.click(screen.getByRole("button", { name: "Load More" }))
    expect(await screen.findByText("Attempt 1")).toBeTruthy()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    expect(fetchGeneralPracticeHistory).toHaveBeenNthCalledWith(2, quizId, "2")
    expect(screen.queryByRole("button", { name: "Load More" })).toBeNull()
    expect(screen.getByRole("link", { name: "Review result for attempt 1" }).getAttribute("href")).toContain("/complete/a1")
  })

  it("shows an empty history without a Load More action", async () => {
    renderRoutes(`/app/practice/general/${quizId}/history`)
    expect(await screen.findByText("No saved attempts yet.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Load More" })).toBeNull()
  })

  it("falls back to the quiz listing when archived quiz details are unavailable", async () => {
    fetchGeneralPracticeQuiz.mockRejectedValueOnce(Object.assign(new Error("Not found"), { status: 404 }))
    fetchGeneralPracticeHistory.mockResolvedValueOnce({ attempts: [
      { attemptId: "a1", quizId, attemptNumber: 1, title: "Thai greetings", score: 2, total: 2, percentage: 100 },
    ], pageSize: 10, nextCursor: null })
    renderRoutes(`/app/practice/general/${quizId}/history`)
    expect(await screen.findByRole("heading", { name: "Thai greetings" })).toBeTruthy()
    expect(await screen.findByRole("link", { name: "Back to General Practice" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to General Practice" }).getAttribute("href")).toBe("/app/practice/general")
  })

  it("offers retry after a history error", async () => {
    fetchGeneralPracticeHistory.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 503 }))
      .mockResolvedValueOnce({ attempts: [], pageSize: 10, nextCursor: null })
    renderRoutes(`/app/practice/general/${quizId}/history`)
    expect((await screen.findByRole("alert")).textContent).toContain("temporarily unavailable")
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("No saved attempts yet.")).toBeTruthy()
  })
})
