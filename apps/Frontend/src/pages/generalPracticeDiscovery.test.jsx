import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import StudentPractice from "./StudentPractice"
import GeneralPracticeList from "./GeneralPracticeList"
import GeneralPracticeDetails from "./GeneralPracticeDetails"
import StudentLayout from "../layouts/StudentLayout"

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Student", role: "user" }, logout: vi.fn() }),
}))
vi.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({ unreadCount: 0 }),
}))

vi.mock("../services/generalPracticeService", () => ({
  fetchGeneralPracticeQuizzes: vi.fn(),
  fetchGeneralPracticeQuiz: vi.fn(),
  startGeneralPracticeSession: vi.fn(),
  submitGeneralPracticeQuiz: vi.fn(),
  fetchGeneralPracticeResult: vi.fn(),
}))

import { fetchGeneralPracticeQuizzes, fetchGeneralPracticeQuiz } from "../services/generalPracticeService"

const quiz = {
  id: "6acc46dbad4ace5e3d908d2c",
  title: "Thai greetings",
  description: "Practice everyday greetings.",
  category: "Vocabulary",
  difficulty: "Beginner",
  standaloneAccess: "students",
  revision: 1,
}

function renderRoutes(path) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/app/practice" element={<StudentPractice />} />
    <Route path="/app/practice/general" element={<GeneralPracticeList />} />
    <Route path="/app/practice/general/:quizId" element={<GeneralPracticeDetails />} />
  </Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchGeneralPracticeQuizzes.mockResolvedValue([quiz])
  fetchGeneralPracticeQuiz.mockResolvedValue(quiz)
})

describe("General Practice discovery", () => {
  it("adds an entry to existing Student Practice without removing prior activities", async () => {
    renderRoutes("/app/practice")
    expect(screen.getByText("Thai consonants")).toBeTruthy()
    expect(screen.getByText("Thai vowels")).toBeTruthy()
    expect(screen.getByText("Flashcards")).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("link", { name: /General Practice/i }))
    expect(await screen.findByText("Thai greetings")).toBeTruthy()
  })

  it("shows published metadata and opens details without starting a session", async () => {
    renderRoutes("/app/practice/general")
    expect(screen.getByRole("status").textContent).toContain("Loading")
    expect(await screen.findByText("Thai greetings")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to Practice Overview" }).getAttribute("href")).toBe("/app/practice")
    expect(screen.getByText("Vocabulary")).toBeTruthy()
    expect(screen.queryByText("Practice Thai")).toBeNull()
    await userEvent.setup().click(screen.getByRole("link", { name: "View details for Thai greetings" }))
    expect(await screen.findByRole("heading", { name: "Thai greetings" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to General Practice" }).getAttribute("href")).toBe("/app/practice/general")
    expect(screen.getByText("Students Only")).toBeTruthy()
    expect(screen.getByText("Access").querySelector(".lucide-lock-keyhole")).toBeTruthy()
    const start = screen.getByRole("button", { name: "Start / Resume Quiz" })
    expect(start.disabled).toBe(false)
    expect(screen.getByText(/unsubmitted selections will not be restored/i)).toBeTruthy()
    expect(fetchGeneralPracticeQuiz).toHaveBeenCalledWith(quiz.id)
  })

  it("uses an open-lock icon for Public quiz access", async () => {
    fetchGeneralPracticeQuiz.mockResolvedValue({ ...quiz, standaloneAccess: "public" })
    renderRoutes(`/app/practice/general/${quiz.id}`)
    expect(await screen.findByText("Public quiz")).toBeTruthy()
    expect(screen.getByText("Access").querySelector(".lucide-lock-open")).toBeTruthy()
  })

  it("shows an empty state", async () => {
    fetchGeneralPracticeQuizzes.mockResolvedValue([])
    renderRoutes("/app/practice/general")
    expect(await screen.findByText("No quizzes available yet")).toBeTruthy()
  })

  it("gives different quizzes distinct accessible link names while keeping the visible label", async () => {
    fetchGeneralPracticeQuizzes.mockResolvedValue([quiz, { ...quiz, id: "another-quiz", title: "Thai numbers" }])
    renderRoutes("/app/practice/general")
    const greetings = await screen.findByRole("link", { name: "View details for Thai greetings" })
    const numbers = screen.getByRole("link", { name: "View details for Thai numbers" })
    expect(greetings.textContent).toContain("View quiz details")
    expect(numbers.textContent).toContain("View quiz details")
  })

  it("distinguishes accessible link names when quiz titles are repeated", async () => {
    fetchGeneralPracticeQuizzes.mockResolvedValue([quiz, { ...quiz, id: "another-quiz" }])
    renderRoutes("/app/practice/general")
    expect(await screen.findByRole("link", { name: "View details for Thai greetings, quiz 1" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "View details for Thai greetings, quiz 2" })).toBeTruthy()
  })

  it("offers retry after a listing failure", async () => {
    fetchGeneralPracticeQuizzes.mockRejectedValueOnce(new Error("Unavailable"))
    renderRoutes("/app/practice/general")
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load")
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Thai greetings")).toBeTruthy()
  })

  it("handles inaccessible details without exposing quiz content", async () => {
    fetchGeneralPracticeQuiz.mockRejectedValue(Object.assign(new Error("Unavailable"), { status: 404 }))
    renderRoutes(`/app/practice/general/${quiz.id}`)
    expect((await screen.findByRole("alert")).textContent).toContain("no longer available")
    expect(screen.queryByRole("button", { name: "Start / Resume Quiz" })).toBeNull()
  })

  it("shows an authentication error when a request is rejected", async () => {
    fetchGeneralPracticeQuizzes.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }))
    renderRoutes("/app/practice/general")
    expect((await screen.findByRole("alert")).textContent).toContain("sign in again")
  })

  it.each([
    "/app/practice/general",
    "/app/practice/general/quiz-1",
    "/app/practice/general/quiz-1/take",
  ])("keeps General Practice active in the desktop sidebar at %s", (path) => {
    render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/app" element={<StudentLayout />}>
        <Route path="practice/general/*" element={<p>General Practice page</p>} />
      </Route>
    </Routes></MemoryRouter>)
    const navigation = screen.getByLabelText("Practice activities")
    expect(within(navigation).getAllByRole("link")).toHaveLength(5)
    expect(within(navigation).getByRole("link", { name: "General Practice" }).getAttribute("aria-current")).toBe("page")
    for (const name of ["Overview", "Consonants", "Vowels", "Flashcards"]) {
      expect(within(navigation).getByRole("link", { name })).toBeTruthy()
    }
    expect(screen.getByRole("button", { name: "Toggle Practice submenu" }).getAttribute("aria-expanded")).toBe("true")
    expect(screen.getAllByRole("navigation", { name: "Student navigation" })).toHaveLength(2)
    expect(screen.queryByRole("navigation", { name: "Practice activities" })).toBeNull()
  })

  it("keeps the mobile Practice destination pointed at the activity hub", () => {
    render(<MemoryRouter initialEntries={["/app/practice/general"]}><Routes>
      <Route path="/app" element={<StudentLayout />}>
        <Route path="practice/general" element={<p>General Practice page</p>} />
      </Route>
    </Routes></MemoryRouter>)
    const mobileNavigation = screen.getAllByRole("navigation", { name: "Student navigation" })[1]
    expect(within(mobileNavigation).getByRole("link", { name: "Practice" }).getAttribute("href")).toBe("/app/practice")
  })

  it.each([
    ["/app/practice", "Overview"],
    ["/app/practice/thai-consonants", "Consonants"],
    ["/app/practice/thai-vowels", "Vowels"],
    ["/app/practice/flashcards", "Flashcards"],
    ["/app/practice/general/quiz-1/history", "General Practice"],
  ])("highlights %s in the Practice sidebar", (path, activeLabel) => {
    render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/app" element={<StudentLayout />}>
        <Route path="practice/*" element={<p>Practice page</p>} />
      </Route>
    </Routes></MemoryRouter>)
    const submenu = screen.getByLabelText("Practice activities")
    expect(within(submenu).getByRole("link", { name: activeLabel }).getAttribute("aria-current")).toBe("page")
  })
})
