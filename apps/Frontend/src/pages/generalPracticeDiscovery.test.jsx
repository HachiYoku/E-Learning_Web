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
  fetchGeneralPracticeSets: vi.fn(),
  fetchGeneralPracticeSet: vi.fn(),
  fetchGeneralPracticeQuiz: vi.fn(),
  startGeneralPracticeSession: vi.fn(),
  submitGeneralPracticeQuiz: vi.fn(),
  fetchGeneralPracticeResult: vi.fn(),
}))

import { fetchGeneralPracticeSets, fetchGeneralPracticeSet, fetchGeneralPracticeQuiz } from "../services/generalPracticeService"

const quiz = {
  id: "6acc46dbad4ace5e3d908d2c",
  title: "Thai greetings",
  description: "Practice everyday greetings.",
  category: "Vocabulary",
  difficulty: "Beginner",
  standaloneAccess: "students",
  revision: 1,
}
const quizSet = { id: "6acc46dbad4ace5e3d908d2e", name: "Thai greetings Set", description: "Practice greetings.", difficulty: "Beginner", coverImage: "", displayOrder: 1 }

function renderRoutes(path) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/app/practice" element={<StudentPractice />} />
    <Route path="/app/practice/general" element={<GeneralPracticeList />} />
    <Route path="/app/practice/general/:quizId" element={<GeneralPracticeDetails />} />
  </Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchGeneralPracticeSets.mockResolvedValue({ sets: [quizSet], pageSize: 10, nextCursor: null })
  fetchGeneralPracticeSet.mockResolvedValue({ set: quizSet, quizzes: [quiz] })
  fetchGeneralPracticeQuiz.mockResolvedValue(quiz)
})

describe("General Practice discovery", () => {
  it("adds an entry to existing Student Practice without removing prior activities", async () => {
    renderRoutes("/app/practice")
    expect(screen.getByText("Thai consonants")).toBeTruthy()
    expect(screen.getByText("Thai vowels")).toBeTruthy()
    expect(screen.getByText("Flashcards")).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("link", { name: /General Practice/i }))
    expect(await screen.findByText("Thai greetings Set")).toBeTruthy()
  })

  it("preserves direct quiz details without starting a session", async () => {
    const catalog = renderRoutes("/app/practice/general")
    expect(screen.getByRole("status").textContent).toContain("Loading")
    expect(await screen.findByText("Thai greetings Set")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to Practice Overview" }).getAttribute("href")).toBe("/app/practice")
    expect(screen.getByRole("link", { name: `View Quiz Set ${quizSet.name}` }).getAttribute("href")).toBe(`/app/practice/general/sets/${quizSet.id}`)
    catalog.unmount()
    renderRoutes(`/app/practice/general/${quiz.id}`)
    expect(await screen.findByRole("heading", { name: "Thai greetings" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to General Practice" }).getAttribute("href")).toBe("/app/practice/general")
    const accessHeading = screen.getByText("Access")
    const badge = screen.getByText("Signed-in students")
    expect(accessHeading.tagName).toBe("DT")
    expect(accessHeading.querySelector(".lucide-shield-check")).toBeTruthy()
    for (const value of ["Vocabulary", "Beginner", "Signed-in students"]) {
      expect(screen.getByText(value).closest("dd").className).toContain("mt-1 flex min-h-9 items-center")
    }
    expect(badge.querySelector(".lucide-lock-keyhole")).toBeTruthy()
    expect(badge.className).toContain("bg-[#F6F3EE]")
    const start = screen.getByRole("button", { name: "Start / Resume Quiz" })
    expect(start.disabled).toBe(false)
    expect(screen.getByText(/unsubmitted selections will not be restored/i)).toBeTruthy()
    expect(fetchGeneralPracticeQuiz).toHaveBeenCalledWith(quiz.id)
  })

  it("treats a legacy Public quiz as signed-in only", async () => {
    fetchGeneralPracticeQuiz.mockResolvedValue({ ...quiz, standaloneAccess: "public" })
    renderRoutes(`/app/practice/general/${quiz.id}`)
    const badge = await screen.findByText("Signed-in students")
    expect(screen.getByText("Access").tagName).toBe("DT")
    expect(badge.querySelector(".lucide-lock-keyhole")).toBeTruthy()
    expect(badge.className).toContain("bg-[#F6F3EE]")
  })

  it("does not label unexpected access metadata as public", async () => {
    fetchGeneralPracticeQuiz.mockResolvedValue({ ...quiz, standaloneAccess: undefined })
    renderRoutes(`/app/practice/general/${quiz.id}`)
    expect(await screen.findByText("Signed-in students")).toBeTruthy()
    expect(screen.queryByText("Public")).toBeNull()
  })

  it("shows an empty state", async () => {
    fetchGeneralPracticeSets.mockResolvedValue({ sets: [], pageSize: 10, nextCursor: null })
    renderRoutes("/app/practice/general")
    expect(await screen.findByText("No Quiz Sets available yet")).toBeTruthy()
  })

  it("offers retry after a listing failure", async () => {
    fetchGeneralPracticeSets.mockRejectedValueOnce(new Error("Unavailable"))
    renderRoutes("/app/practice/general")
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load")
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Thai greetings Set")).toBeTruthy()
  })

  it("handles inaccessible details without exposing quiz content", async () => {
    fetchGeneralPracticeQuiz.mockRejectedValue(Object.assign(new Error("Unavailable"), { status: 404 }))
    renderRoutes(`/app/practice/general/${quiz.id}`)
    expect((await screen.findByRole("alert")).textContent).toContain("no longer available")
    expect(screen.queryByRole("button", { name: "Start / Resume Quiz" })).toBeNull()
  })

  it("shows an authentication error when a request is rejected", async () => {
    fetchGeneralPracticeSets.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }))
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
