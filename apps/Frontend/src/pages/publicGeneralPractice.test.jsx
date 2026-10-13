import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Navbar from "../components/Navbar"
import Login from "./Login"
import PublicGeneralPracticeLayout from "./PublicGeneralPracticeLayout"
import GeneralPracticeList from "./GeneralPracticeList"
import GeneralPracticeDetails from "./GeneralPracticeDetails"
import RequireAuth from "../routes/RequireAuth"

const auth = vi.hoisted(() => ({ isAuthenticated: false, isBootstrapping: false, user: null, login: null, logout: null, clearLocalSession: null }))
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => auth }))
vi.mock("../contexts/NotificationContext", () => ({ useNotification: () => ({ unreadCount: 0, isOpen: false, setIsOpen: vi.fn(), notifications: [], loading: false, markAsRead: vi.fn(), markAllRead: vi.fn() }) }))
vi.mock("../contexts/ToastContext", () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock("../components/Footer", () => ({ default: () => <footer>Public footer</footer> }))
vi.mock("../services/authService", () => ({ resendVerification: vi.fn() }))
vi.mock("../services/generalPracticeService", () => ({ fetchGeneralPracticeQuizzes: vi.fn(), fetchGeneralPracticeQuiz: vi.fn(), startGeneralPracticeSession: vi.fn() }))
import { fetchGeneralPracticeQuizzes, fetchGeneralPracticeQuiz, startGeneralPracticeSession } from "../services/generalPracticeService"

const publicQuiz = { id: "6acc46dbad4ace5e3d908d2c", title: "Thai greetings", description: "Practice greetings.", category: "Vocabulary", difficulty: "Beginner", standaloneAccess: "public" }
const restrictedQuiz = { ...publicQuiz, id: "6acc46dbad4ace5e3d908d2d", title: "Private review", standaloneAccess: "students" }

function Pathname() { return <p data-testid="pathname">{useLocation().pathname}</p> }

function renderRoutes(initialEntry = "/practice/general") {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Pathname /><Routes>
    <Route path="/practice/general" element={<PublicGeneralPracticeLayout />}>
      <Route index element={<GeneralPracticeList publicView />} />
      <Route path=":quizId" element={<GeneralPracticeDetails publicView />} />
    </Route>
    <Route path="/login" element={<Login />} />
    <Route path="/app" element={<p>Student dashboard</p>} />
    <Route element={<RequireAuth />}>
      <Route path="/app/practice/general/:quizId" element={<GeneralPracticeDetails />} />
      <Route path="/app/practice/general/:quizId/take" element={<p>Protected attempt</p>} />
      <Route path="/app/practice/general/:quizId/history" element={<p>Protected history</p>} />
      <Route path="/app/practice/general/:quizId/complete/:attemptId" element={<p>Protected result</p>} />
    </Route>
  </Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.isAuthenticated = false
  auth.isBootstrapping = false
  auth.user = null
  auth.logout = vi.fn()
  auth.clearLocalSession = vi.fn()
  auth.login = vi.fn().mockImplementation(async () => { auth.isAuthenticated = true; auth.user = { role: "user" }; return auth.user })
  fetchGeneralPracticeQuizzes.mockResolvedValue([publicQuiz, restrictedQuiz])
  fetchGeneralPracticeQuiz.mockResolvedValue(publicQuiz)
})

describe("public General Practice", () => {
  it("shows public metadata and excludes Students Only quizzes", async () => {
    renderRoutes()
    expect(await screen.findByText("Thai greetings")).toBeTruthy()
    expect(screen.queryByText("Private review")).toBeNull()
    expect(screen.getByText("Vocabulary")).toBeTruthy()
    expect(screen.getByText("Public footer")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to Home" }).getAttribute("href")).toBe("/")
    expect(screen.getByRole("link", { name: "View details for Thai greetings" }).getAttribute("href")).toBe(`/practice/general/${publicQuiz.id}`)
    expect(startGeneralPracticeSession).not.toHaveBeenCalled()
  })

  it("returns a guest to protected quiz details after login without creating a session", async () => {
    renderRoutes()
    await userEvent.setup().click(await screen.findByRole("link", { name: "View details for Thai greetings" }))
    expect(await screen.findByRole("heading", { name: "Thai greetings" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to Home" }).getAttribute("href")).toBe("/")
    expect(screen.getByRole("link", { name: "Log in to Start Quiz" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: /attempt history/i })).toBeNull()
    await userEvent.setup().click(screen.getByRole("link", { name: "Log in to Start Quiz" }))
    expect(screen.getByTestId("pathname").textContent).toBe("/login")
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Email address" }), "student@example.test")
    await userEvent.setup().type(screen.getByLabelText("Password"), "example-password")
    await userEvent.setup().click(screen.getByRole("button", { name: "Log in" }))
    expect(await screen.findByRole("button", { name: "Start / Resume Quiz" })).toBeTruthy()
    expect(screen.getByTestId("pathname").textContent).toBe(`/app/practice/general/${publicQuiz.id}`)
    expect(startGeneralPracticeSession).not.toHaveBeenCalled()
  })

  it("does not render restricted details to a guest even if the response supplies them", async () => {
    fetchGeneralPracticeQuiz.mockResolvedValue(restrictedQuiz)
    renderRoutes(`/practice/general/${restrictedQuiz.id}`)
    expect((await screen.findByRole("alert")).textContent).toContain("no longer available")
    expect(screen.queryByText("Private review")).toBeNull()
    expect(screen.queryByRole("link", { name: "Log in to Start Quiz" })).toBeNull()
  })

  it("sends a signed-in student to protected details without creating a session", async () => {
    auth.isAuthenticated = true
    auth.user = { role: "user" }
    renderRoutes(`/practice/general/${publicQuiz.id}`)
    expect((await screen.findByRole("link", { name: "Continue in Student portal" })).getAttribute("href")).toBe(`/app/practice/general/${publicQuiz.id}`)
    expect(startGeneralPracticeSession).not.toHaveBeenCalled()
  })

  it.each([
    `/app/practice/general/${publicQuiz.id}/take`,
    `/app/practice/general/${publicQuiz.id}/history`,
    `/app/practice/general/${publicQuiz.id}/complete/attempt-1`,
  ])("redirects guests away from protected attempt route %s", async (path) => {
    renderRoutes(path)
    expect((await screen.findByTestId("pathname")).textContent).toBe("/login")
    expect(screen.queryByText("Protected attempt")).toBeNull()
    expect(screen.queryByText("Protected history")).toBeNull()
    expect(screen.queryByText("Protected result")).toBeNull()
  })

  it("keeps the selected quiz destination after a failed login attempt", async () => {
    auth.login.mockRejectedValueOnce(new Error("Invalid credentials"))
    renderRoutes(`/practice/general/${publicQuiz.id}`)
    await userEvent.setup().click(await screen.findByRole("link", { name: "Log in to Start Quiz" }))
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Email address" }), "student@example.test")
    await userEvent.setup().type(screen.getByLabelText("Password"), "incorrect-password")
    await userEvent.setup().click(screen.getByRole("button", { name: "Log in" }))
    expect(await screen.findByText("Invalid credentials")).toBeTruthy()
    expect(screen.getByTestId("pathname").textContent).toBe("/login")
    expect(startGeneralPracticeSession).not.toHaveBeenCalled()
  })

  it("shows a retry state when public details cannot load", async () => {
    fetchGeneralPracticeQuiz.mockRejectedValueOnce(new Error("Unavailable"))
    renderRoutes(`/practice/general/${publicQuiz.id}`)
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load")
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("heading", { name: "Thai greetings" })).toBeTruthy()
  })

  it("handles empty, error, and retry states", async () => {
    fetchGeneralPracticeQuizzes.mockResolvedValueOnce([])
    const view = renderRoutes()
    expect(await screen.findByText("No quizzes available yet")).toBeTruthy()
    view.unmount()
    fetchGeneralPracticeQuizzes.mockRejectedValueOnce(new Error("Unavailable"))
    renderRoutes()
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load")
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Thai greetings")).toBeTruthy()
  })
})

describe("public Practice navigation", () => {
  it("retains existing desktop destinations and opens General Practice", async () => {
    render(<MemoryRouter initialEntries={["/practice"]}><Navbar /><Routes><Route path="/practice" element={<p>Practice home</p>} /><Route path="/practice/general" element={<p>Public catalog</p>} /></Routes></MemoryRouter>)
    const practice = screen.getAllByRole("button", { name: "Practice" })[0]
    await userEvent.setup().click(practice)
    const menu = practice.parentElement
    expect(within(menu).getByRole("button", { name: "Thai Consonants" })).toBeTruthy()
    expect(within(menu).getByRole("button", { name: "Thai Vowels" })).toBeTruthy()
    expect(within(menu).getByRole("button", { name: "Flashcards" })).toBeTruthy()
    await userEvent.setup().click(within(menu).getByRole("button", { name: "General Practice" }))
    expect(screen.getByText("Public catalog")).toBeTruthy()
  })

  it("opens General Practice from the mobile Practice dropdown", async () => {
    render(<MemoryRouter initialEntries={["/practice"]}><Navbar /><Routes><Route path="/practice" element={<p>Practice home</p>} /><Route path="/practice/general" element={<p>Public catalog</p>} /></Routes></MemoryRouter>)
    await userEvent.setup().click(screen.getByRole("button", { name: "Open navigation menu" }))
    const mobilePractice = screen.getAllByRole("button", { name: "Practice" })[1]
    await userEvent.setup().click(mobilePractice)
    await userEvent.setup().click(within(mobilePractice.parentElement).getByRole("button", { name: "General Practice" }))
    expect(screen.getByText("Public catalog")).toBeTruthy()
  })
})
