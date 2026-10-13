import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import GeneralPracticeDetails from "./GeneralPracticeDetails"
import GeneralPracticeTake from "./GeneralPracticeTake"
import GeneralPracticeComplete from "./GeneralPracticeComplete"

vi.mock("../services/generalPracticeService", () => ({
  fetchGeneralPracticeQuiz: vi.fn(),
  startGeneralPracticeSession: vi.fn(),
  submitGeneralPracticeQuiz: vi.fn(),
  fetchGeneralPracticeResult: vi.fn(),
}))

import { fetchGeneralPracticeQuiz, startGeneralPracticeSession, submitGeneralPracticeQuiz, fetchGeneralPracticeResult } from "../services/generalPracticeService"
import { apiClient } from "../api/client"

const quizId = "6acc46dbad4ace5e3d908d2c"
const attemptId = "6acc46dbad4ace5e3d908d2d"
const quiz = { id: quizId, title: "Thai greetings", description: "Choose the right phrase.", standaloneAccess: "public" }
function session(created = true, expiry = Date.now() + 60_000) {
  return { sessionId: "session-1", revision: 2, expiresAt: new Date(expiry).toISOString(), title: quiz.title, created,
    questions: [
      { _id: "q1", prompt: "Choose hello", options: ["สวัสดี", "ขอบคุณ"], image: "https://example.test/hello.png", imageAlt: "A person greeting", imageDecorative: false },
      { _id: "q2", prompt: "Choose thanks", options: ["ลาก่อน", "ขอบคุณ"], audio: "https://example.test/thanks.mp3", audioLabel: "Listen to the Thai phrase" },
    ] }
}

function renderFlow(path = `/app/practice/general/${quizId}/take`, state = { quizId, session: session() }) {
  return render(<MemoryRouter initialEntries={[{ pathname: path, state }]}><Routes>
    <Route path="/app/practice/general" element={<h1>General Practice list</h1>} />
    <Route path="/app/practice/general/:quizId" element={<GeneralPracticeDetails />} />
    <Route path="/app/practice/general/:quizId/take" element={<GeneralPracticeTake />} />
    <Route path="/app/practice/general/:quizId/complete/:attemptId" element={<GeneralPracticeComplete />} />
  </Routes></MemoryRouter>)
}

async function answerAndConfirm(user) {
  await user.click(screen.getByRole("radio", { name: "สวัสดี" }))
  await user.click(screen.getByRole("button", { name: "Next" }))
  await user.click(screen.getByRole("radio", { name: "ขอบคุณ" }))
  await user.click(screen.getByRole("button", { name: "Submit Quiz" }))
  expect(screen.getByRole("dialog", { name: "Submit your quiz?" })).toBeTruthy()
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchGeneralPracticeQuiz.mockResolvedValue(quiz)
  startGeneralPracticeSession.mockResolvedValue(session())
  submitGeneralPracticeQuiz.mockResolvedValue({ attemptId, quizId })
  fetchGeneralPracticeResult.mockResolvedValue({ attemptId, quizId, title: quiz.title })
})

describe("General Practice taking", () => {
  it("starts once despite repeated clicks, then renders the new session", async () => {
    let resolveStart
    startGeneralPracticeSession.mockImplementation(() => new Promise((resolve) => { resolveStart = resolve }))
    const user = userEvent.setup()
    renderFlow(`/app/practice/general/${quizId}`, null)
    await user.click(await screen.findByRole("button", { name: "Start / Resume Quiz" }))
    expect(screen.getByRole("button", { name: "Starting quiz..." }).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Starting quiz..." }))
    expect(startGeneralPracticeSession).toHaveBeenCalledTimes(1)
    await act(async () => resolveStart(session()))
    expect(await screen.findByRole("heading", { name: quiz.title })).toBeTruthy()
    expect(screen.getByText(/unsubmitted selections are not saved/i)).toBeTruthy()
    expect(screen.queryByText(/correct answer/i)).toBeNull()
  })

  it("resumes an unfinished session with blank answers after a direct reload", async () => {
    startGeneralPracticeSession.mockResolvedValue(session(false))
    renderFlow(`/app/practice/general/${quizId}/take`, null)
    expect(screen.getByRole("heading", { name: "Ready to practice?" })).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("button", { name: "Start / Resume Quiz" }))
    expect(await screen.findByText(/Unfinished session resumed/i)).toBeTruthy()
    expect(screen.getByText(/0 of 2 answered/i)).toBeTruthy()
    expect(startGeneralPracticeSession).toHaveBeenCalledTimes(1)
  })

  it("handles a rate-limited start without creating another session", async () => {
    startGeneralPracticeSession.mockRejectedValueOnce(Object.assign(new Error("Limited"), { status: 429, retryAfter: "30" }))
    renderFlow(`/app/practice/general/${quizId}`, null)
    await userEvent.setup().click(await screen.findByRole("button", { name: "Start / Resume Quiz" }))
    expect((await screen.findByRole("alert")).textContent).toContain("30 seconds")
    expect(startGeneralPracticeSession).toHaveBeenCalledTimes(1)
  })

  it("shows temporary Backend unavailability during start", async () => {
    startGeneralPracticeSession.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 503 }))
    renderFlow(`/app/practice/general/${quizId}`, null)
    await userEvent.setup().click(await screen.findByRole("button", { name: "Start / Resume Quiz" }))
    expect((await screen.findByRole("alert")).textContent).toContain("temporarily unavailable")
  })

  it("navigates questions, renders supported media, and tracks answers without browser storage", async () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem")
    const user = userEvent.setup()
    renderFlow()
    expect(screen.getByAltText("A person greeting")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Submit Quiz" })).toBeNull()
    await user.click(screen.getByRole("radio", { name: "สวัสดี" }))
    expect(screen.getByRole("button", { name: "Question 1, answered" })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByLabelText("Listen to the Thai phrase")).toBeTruthy()
    await user.click(screen.getByRole("radio", { name: "ขอบคุณ" }))
    expect(screen.getByText(/2 of 2 answered/i)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Previous" }))
    expect(screen.getByRole("radio", { name: "สวัสดี" }).checked).toBe(true)
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })

  it("returns to the first unanswered question instead of opening confirmation", async () => {
    const user = userEvent.setup()
    renderFlow()
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Submit Quiz" }))
    expect(screen.getByRole("button", { name: "Question 1, unanswered" }).getAttribute("aria-current")).toBe("step")
    expect(screen.getByRole("alert").textContent).toContain("2 questions are still unanswered. Please choose an answer before finishing.")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(submitGeneralPracticeQuiz).not.toHaveBeenCalled()
    await user.click(screen.getByRole("radio", { name: "สวัสดี" }))
    expect(screen.queryByRole("alert")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("radio", { name: "ขอบคุณ" }))
    await user.click(screen.getByRole("button", { name: "Submit Quiz" }))
    const dialog = screen.getByRole("dialog", { name: "Submit your quiz?" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(dialog.textContent).toContain("answered all 2 questions")
    await user.click(screen.getByRole("button", { name: "Continue Quiz" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("button", { name: "Submit Quiz" })).toBeTruthy()
  })

  it("selects the earliest unanswered question in quiz order and revalidates", async () => {
    const extended = session()
    extended.questions = [
      ...extended.questions,
      { _id: "q3", prompt: "Question three", options: ["Three A", "Three B"] },
      { _id: "q4", prompt: "Question four", options: ["Four A", "Four B"] },
    ]
    const user = userEvent.setup()
    renderFlow(`/app/practice/general/${quizId}/take`, { quizId, session: extended })
    await user.click(screen.getByRole("radio", { name: "สวัสดี" }))
    await user.click(screen.getByRole("button", { name: "Question 3, unanswered" }))
    await user.click(screen.getByRole("radio", { name: "Three A" }))
    await user.click(screen.getByRole("button", { name: "Question 4, unanswered" }))
    await user.click(screen.getByRole("radio", { name: "Four B" }))
    await user.click(screen.getByRole("button", { name: "Submit Quiz" }))
    expect(screen.getByRole("button", { name: "Question 2, unanswered" }).getAttribute("aria-current")).toBe("step")
    expect(screen.getByRole("alert").textContent).toContain("1 question is still unanswered")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(submitGeneralPracticeQuiz).not.toHaveBeenCalled()
    await user.click(screen.getByRole("radio", { name: "ขอบคุณ" }))
    await user.click(screen.getByRole("button", { name: "Question 4, answered" }))
    await user.click(screen.getByRole("button", { name: "Submit Quiz" }))
    expect(screen.getByRole("dialog", { name: "Submit your quiz?" })).toBeTruthy()
  })

  it("closes confirmation with Escape and restores focus to Submit Quiz", async () => {
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    expect(screen.getByRole("dialog").querySelector(".border-t")).toBeTruthy()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Submit Quiz" })))
    expect(submitGeneralPracticeQuiz).not.toHaveBeenCalled()
  })

  it("submits the exact snapshot payload once and verifies the saved attempt without showing results", async () => {
    let resolveSubmit
    submitGeneralPracticeQuiz.mockImplementation(() => new Promise((resolve) => { resolveSubmit = resolve }))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    fireEvent.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect(submitGeneralPracticeQuiz).toHaveBeenCalledWith(quizId, { sessionId: "session-1", revision: 2, answers: [0, 1] })
    expect(submitGeneralPracticeQuiz).toHaveBeenCalledTimes(1)
    await act(async () => resolveSubmit({ attemptId, quizId }))
    expect(await screen.findByRole("heading", { name: quiz.title })).toBeTruthy()
    expect(screen.queryByText(`Attempt reference: ${attemptId}`)).toBeNull()
    expect(screen.queryByText(/correct answer/i)).toBeNull()
    expect(fetchGeneralPracticeResult).toHaveBeenCalledWith(attemptId)
  })

  it("preserves the frozen submission on a network-uncertain outcome and retries only by user choice", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(new TypeError("Network failed"))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect(await screen.findByRole("heading", { name: "Submission status unknown" })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "ขอบคุณ" }).disabled).toBe(true)
    expect(submitGeneralPracticeQuiz).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "Retry this same submission" }))
    expect(submitGeneralPracticeQuiz).toHaveBeenCalledTimes(2)
    expect(submitGeneralPracticeQuiz.mock.calls[1][1]).toBe(submitGeneralPracticeQuiz.mock.calls[0][1])
    expect(await screen.findByRole("heading", { name: quiz.title })).toBeTruthy()
  })

  it("warns before in-app navigation and preserves the original recovery payload when leaving is canceled", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(new TypeError("Network failed"))
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    try {
      const user = userEvent.setup()
      renderFlow()
      await answerAndConfirm(user)
      await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
      expect(await screen.findByRole("heading", { name: "Submission status unknown" })).toBeTruthy()
      await user.click(screen.getByRole("link", { name: "Back to quiz details" }))
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("lose the original submission"))
      expect(screen.getByRole("heading", { name: "Submission status unknown" })).toBeTruthy()
      expect(screen.queryByRole("heading", { name: "General Practice list" })).toBeNull()
      await user.click(screen.getByRole("button", { name: "Retry this same submission" }))
      expect(submitGeneralPracticeQuiz.mock.calls[1][1]).toBe(submitGeneralPracticeQuiz.mock.calls[0][1])
      expect(await screen.findByRole("heading", { name: quiz.title })).toBeTruthy()
    } finally {
      confirm.mockRestore()
    }
  })

  it("allows a deliberate in-app exit after warning without resubmitting", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(new TypeError("Network failed"))
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    try {
      const user = userEvent.setup()
      renderFlow()
      await answerAndConfirm(user)
      await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
      await user.click(await screen.findByRole("link", { name: "Back to quiz details" }))
      expect(confirm).toHaveBeenCalledOnce()
      expect(await screen.findByRole("button", { name: "Start / Resume Quiz" })).toBeTruthy()
      expect(submitGeneralPracticeQuiz).toHaveBeenCalledTimes(1)
    } finally {
      confirm.mockRestore()
    }
  })

  it("keeps an uncertain submission available for replay after session expiry", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 503 }))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect(await screen.findByRole("heading", { name: "Submission status unknown" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Retry this same submission" })).toBeTruthy()
  })

  it("shows rate-limit Retry-After and keeps selected answers", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(Object.assign(new Error("Rate limited"), { status: 429, retryAfter: "42" }))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect((await screen.findByRole("alert")).textContent).toContain("42 seconds")
    expect(screen.getByRole("radio", { name: "ขอบคุณ" }).checked).toBe(true)
  })

  it("handles invalidated and unavailable sessions without submitting again", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(Object.assign(new Error("Expired"), { status: 409 }))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect(await screen.findByRole("heading", { name: "Session unavailable" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Start a new session" })).toBeTruthy()
    expect(submitGeneralPracticeQuiz).toHaveBeenCalledTimes(1)
  })

  it("treats a 404 submission as an unavailable quiz", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 404 }))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect(await screen.findByRole("heading", { name: "Quiz unavailable" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Start a new session" })).toBeNull()
  })

  it("keeps a previously uncertain payload after a rate-limited replay", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(new TypeError("Network failed"))
      .mockRejectedValueOnce(Object.assign(new Error("Limited"), { status: 429, retryAfter: "10" }))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    await user.click(await screen.findByRole("button", { name: "Retry this same submission" }))
    expect((await screen.findByRole("alert")).textContent).toContain("10 seconds")
    expect(screen.getByRole("button", { name: "Retry this same submission" })).toBeTruthy()
    expect(submitGeneralPracticeQuiz.mock.calls[1][1]).toBe(submitGeneralPracticeQuiz.mock.calls[0][1])
  })

  it("ends uncertainty when replay definitively reports an invalidated session", async () => {
    submitGeneralPracticeQuiz.mockRejectedValueOnce(new TypeError("Network failed"))
      .mockRejectedValueOnce(Object.assign(new Error("Expired"), { status: 409 }))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    await user.click(await screen.findByRole("button", { name: "Retry this same submission" }))
    expect(await screen.findByRole("heading", { name: "Session unavailable" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Submission status unknown" })).toBeNull()
  })

  it("does not use an expired incoming session", () => {
    renderFlow(`/app/practice/general/${quizId}/take`, { quizId, session: session(true, Date.now() - 1000) })
    expect(screen.getByRole("heading", { name: "Session unavailable" })).toBeTruthy()
    expect(screen.queryByRole("radio")).toBeNull()
  })

  it("preserves a confirmed save when the subsequent result read fails, then retries only the read", async () => {
    fetchGeneralPracticeResult.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 503 }))
    const user = userEvent.setup()
    renderFlow()
    await answerAndConfirm(user)
    await user.click(screen.getByRole("button", { name: "Confirm Submit" }))
    expect(await screen.findByRole("heading", { name: "Submission saved" })).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("submission was saved")
    expect(screen.getByRole("alert").textContent).toContain("result is temporarily unavailable")
    expect(submitGeneralPracticeQuiz).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "Retry Loading Result" }))
    expect(await screen.findByRole("heading", { name: quiz.title })).toBeTruthy()
    expect(fetchGeneralPracticeResult).toHaveBeenCalledTimes(2)
    expect(submitGeneralPracticeQuiz).toHaveBeenCalledTimes(1)
  })

  it("does not claim success for an unverified direct attempt URL", async () => {
    fetchGeneralPracticeResult.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status: 404 }))
    renderFlow(`/app/practice/general/${quizId}/complete/${attemptId}`, null)
    expect(await screen.findByRole("heading", { name: "Submission status unverified" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Submission saved" })).toBeNull()
  })

  it("captures Retry-After from a readable API response", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "quiz_rate_limited" }), {
      status: 429, headers: { "Content-Type": "application/json", "Retry-After": "42" },
    }))
    try {
      await expect(apiClient.get("/quizzes/standalone")).rejects.toMatchObject({ status: 429, retryAfter: "42" })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
