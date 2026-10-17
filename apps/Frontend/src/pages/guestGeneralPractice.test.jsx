import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import GeneralPracticeTake from "./GeneralPracticeTake"
import GeneralPracticeComplete from "./GeneralPracticeComplete"

vi.mock("../services/guestGeneralPracticeService", () => ({
  startGuestGeneralPracticeSession: vi.fn(), fetchGuestGeneralPracticeSession: vi.fn(),
  submitGuestGeneralPracticeQuiz: vi.fn(), fetchGuestGeneralPracticeResult: vi.fn(),
}))
import { startGuestGeneralPracticeSession, fetchGuestGeneralPracticeSession,
  submitGuestGeneralPracticeQuiz, fetchGuestGeneralPracticeResult } from "../services/guestGeneralPracticeService"

const quizId = "6acc46dbad4ace5e3d908d2c"
const sessionId = "6acc46dbad4ace5e3d908d2d"
const attemptId = "6acc46dbad4ace5e3d908d2e"
const session = () => ({ sessionId, revision: 2, expiresAt: new Date(Date.now() + 60_000).toISOString(),
  title: "Thai greetings", created: true, questions: [{ _id: "q1", prompt: "Choose hello", options: ["Hello", "Thanks"] }] })
const result = { attemptId, quizId, title: "Thai greetings", score: 1, total: 1, percentage: 100,
  completedAt: new Date().toISOString(), review: [{ questionId: "q1", prompt: "Choose hello", options: ["Hello", "Thanks"],
    selectedAnswer: 0, correctAnswer: 0, isCorrect: true, explanation: "Hello is the greeting." }] }

function Location() { return <p data-testid="location">{useLocation().pathname}</p> }
function renderGuest(path = `/practice/general/${quizId}/guest/take`) {
  return render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/practice/general/:quizId" element={<h1>Quiz details</h1>} />
    <Route path="/practice/general/:quizId/guest/take" element={<GeneralPracticeTake guest />} />
    <Route path="/practice/general/:quizId/guest/sessions/:sessionId" element={<GeneralPracticeTake guest />} />
    <Route path="/practice/general/:quizId/guest/complete/:attemptId" element={<GeneralPracticeComplete guest />} />
  </Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  startGuestGeneralPracticeSession.mockImplementation(async () => session())
  fetchGuestGeneralPracticeSession.mockImplementation(async () => ({ ...session(), created: false }))
  submitGuestGeneralPracticeQuiz.mockResolvedValue({ attemptId, quizId })
  fetchGuestGeneralPracticeResult.mockResolvedValue(result)
})

describe("guest General Practice", () => {
  it("starts and resumes through public routes without revealing answers", async () => {
    renderGuest()
    await userEvent.setup().click(screen.getByRole("button", { name: "Start / Resume Quiz" }))
    expect(await screen.findByText("Choose hello")).toBeTruthy()
    expect(screen.getByTestId("location").textContent).toBe(`/practice/general/${quizId}/guest/sessions/${sessionId}`)
    expect(screen.queryByText("Hello is the greeting.")).toBeNull()
    expect(screen.queryByText(/correct answer/i)).toBeNull()
    expect(startGuestGeneralPracticeSession).toHaveBeenCalledTimes(1)
  })

  it("restores an active session on a direct URL with blank answers", async () => {
    renderGuest(`/practice/general/${quizId}/guest/sessions/${sessionId}`)
    expect(await screen.findByText("Choose hello")).toBeTruthy()
    expect(fetchGuestGeneralPracticeSession).toHaveBeenCalledWith(quizId, sessionId)
    expect(screen.getByText(/0 of 1 answered/i)).toBeTruthy()
    expect(startGuestGeneralPracticeSession).not.toHaveBeenCalled()
  })

  it("submits once and reopens the temporary result after refresh", async () => {
    const user = userEvent.setup()
    renderGuest()
    await user.click(screen.getByRole("button", { name: "Start / Resume Quiz" }))
    await user.click(await screen.findByRole("radio", { name: "Hello" }))
    await user.click(screen.getByRole("button", { name: "Submit Quiz" }))
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect(await screen.findByText("Hello is the greeting.")).toBeTruthy()
    expect(screen.getByText(/not saved to a Student account/i)).toBeTruthy()
    expect(submitGuestGeneralPracticeQuiz).toHaveBeenCalledWith(quizId, { sessionId, revision: 2, answers: [0] })
    expect(fetchGuestGeneralPracticeResult).toHaveBeenCalledWith(attemptId)
    expect(screen.getByTestId("location").textContent).toBe(`/practice/general/${quizId}/guest/complete/${attemptId}`)
  })

  it("retries the identical payload after an uncertain response", async () => {
    submitGuestGeneralPracticeQuiz.mockRejectedValueOnce(new TypeError("Network failed")).mockResolvedValueOnce({ attemptId, quizId })
    const user = userEvent.setup()
    renderGuest()
    await user.click(screen.getByRole("button", { name: "Start / Resume Quiz" }))
    await user.click(await screen.findByRole("radio", { name: "Hello" }))
    await user.click(screen.getByRole("button", { name: "Submit Quiz" }))
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect(await screen.findByText("Submission status unknown")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Retry this same submission" }))
    await screen.findByText("Hello is the greeting.")
    expect(submitGuestGeneralPracticeQuiz).toHaveBeenCalledTimes(2)
    expect(submitGuestGeneralPracticeQuiz.mock.calls[1][1]).toBe(submitGuestGeneralPracticeQuiz.mock.calls[0][1])
  })

  it("reports missing guest credentials or expired sessions without exposing questions", async () => {
    fetchGuestGeneralPracticeSession.mockRejectedValueOnce(Object.assign(new Error("missing"), { status: 401 }))
    renderGuest(`/practice/general/${quizId}/guest/sessions/${sessionId}`)
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("no longer available in this browser"))
    expect(screen.queryByText("Choose hello")).toBeNull()
  })

  it("shows expired temporary result messaging for a direct result URL", async () => {
    fetchGuestGeneralPracticeResult.mockRejectedValueOnce(Object.assign(new Error("gone"), { status: 404 }))
    renderGuest(`/practice/general/${quizId}/guest/complete/${attemptId}`)
    expect((await screen.findByRole("alert")).textContent).toContain("24 hours")
    expect(screen.queryByText("Hello is the greeting.")).toBeNull()
  })

  it("reopens a completed result from its direct URL without starting a new session", async () => {
    renderGuest(`/practice/general/${quizId}/guest/complete/${attemptId}`)
    expect(await screen.findByText("Hello is the greeting.")).toBeTruthy()
    expect(fetchGuestGeneralPracticeResult).toHaveBeenCalledWith(attemptId)
    expect(startGuestGeneralPracticeSession).not.toHaveBeenCalled()
  })
})
