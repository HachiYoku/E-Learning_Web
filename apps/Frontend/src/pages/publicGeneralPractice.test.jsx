import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Navbar from "../components/Navbar"
import Login from "./Login"
import PublicGeneralPracticeLayout from "./PublicGeneralPracticeLayout"
import GeneralPracticeList from "./GeneralPracticeList"
import GeneralPracticeDetails from "./GeneralPracticeDetails"
import GeneralPracticeSetDetails from "./GeneralPracticeSetDetails"
import RequireAuth from "../routes/RequireAuth"

const auth = vi.hoisted(() => ({ isAuthenticated: false, isBootstrapping: false, user: null, login: null, logout: null, clearLocalSession: null }))
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => auth }))
vi.mock("../contexts/NotificationContext", () => ({ useNotification: () => ({ unreadCount: 0, isOpen: false, setIsOpen: vi.fn(), notifications: [], loading: false, markAsRead: vi.fn(), markAllRead: vi.fn() }) }))
vi.mock("../contexts/ToastContext", () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock("../components/Footer", () => ({ default: () => <footer>Public footer</footer> }))
vi.mock("../services/authService", () => ({ resendVerification: vi.fn() }))
vi.mock("../services/generalPracticeService", () => ({ fetchGeneralPracticeSets: vi.fn(), fetchGeneralPracticeSet: vi.fn(), fetchGeneralPracticeQuiz: vi.fn(), startGeneralPracticeSession: vi.fn() }))
import { fetchGeneralPracticeSets, fetchGeneralPracticeSet, fetchGeneralPracticeQuiz, startGeneralPracticeSession } from "../services/generalPracticeService"

const publicQuiz = { id: "6acc46dbad4ace5e3d908d2c", title: "Thai greetings", description: "Practice greetings.", category: "Vocabulary", difficulty: "Beginner", standaloneAccess: "public" }
const restrictedQuiz = { ...publicQuiz, id: "6acc46dbad4ace5e3d908d2d", title: "Private review", standaloneAccess: "students" }
const quizSet = { id: "6acc46dbad4ace5e3d908d2e", name: "Thai greetings Set", description: "Practice greetings.", coverImage: "", difficulty: "Beginner", displayOrder: 1 }

function Pathname() { return <p data-testid="pathname">{useLocation().pathname}</p> }

function renderRoutes(initialEntry = "/practice/general") {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Pathname /><Routes>
    <Route path="/practice/general" element={<PublicGeneralPracticeLayout />}>
      <Route index element={<GeneralPracticeList publicView />} />
      <Route path="sets/:setId" element={<GeneralPracticeSetDetails publicView />} />
      <Route path=":quizId" element={<GeneralPracticeDetails publicView />} />
    </Route>
    <Route path="/login" element={<Login />} />
    <Route path="/app" element={<p>Student dashboard</p>} />
    <Route element={<RequireAuth />}>
      <Route path="/app/practice/general/:quizId" element={<GeneralPracticeDetails />} />
      <Route path="/app/practice/general/sets/:setId" element={<GeneralPracticeSetDetails />} />
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
  fetchGeneralPracticeSets.mockResolvedValue({ sets: [quizSet], pageSize: 10, nextCursor: null })
  fetchGeneralPracticeSet.mockResolvedValue({ set: quizSet, quizzes: [publicQuiz, restrictedQuiz] })
  fetchGeneralPracticeQuiz.mockResolvedValue(publicQuiz)
})

describe("public General Practice", () => {
  it("opens the Set, preserves quiz order, and sends a guest to login for Students Only", async () => {
    fetchGeneralPracticeQuiz.mockResolvedValue(restrictedQuiz)
    renderRoutes()
    await userEvent.setup().click(await screen.findByRole("link", { name: `View Quiz Set ${quizSet.name}` }))
    expect(screen.getByTestId("pathname").textContent).toBe(`/practice/general/sets/${quizSet.id}`)
    expect(await screen.findByRole("heading", { name: quizSet.name })).toBeTruthy()
    expect(screen.getByRole("heading", { name: quizSet.name }).closest("header").className).toContain("md:grid-cols-")
    const cards = screen.getAllByRole("article")
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([publicQuiz.title, restrictedQuiz.title])
    expect(within(cards[0]).getByText("Public").querySelector(".lucide-globe")).toBeTruthy()
    expect(within(cards[1]).getByText("Students Only").querySelector(".lucide-lock-keyhole")).toBeTruthy()
    expect(within(cards[0]).getByText("Vocabulary").className).toContain("rounded-full")
    expect(within(cards[0]).getByText("Beginner").className).toContain("rounded-full")
    expect(within(cards[1]).getByRole("link", { name: `Log in to view ${restrictedQuiz.title}` })).toBeTruthy()
    expect(screen.queryByText(/correct answer|explanation|question prompt/i)).toBeNull()
    await userEvent.setup().click(within(cards[1]).getByRole("link", { name: `Log in to view ${restrictedQuiz.title}` }))
    expect(screen.getByTestId("pathname").textContent).toBe("/login")
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Email address" }), "student@example.test")
    await userEvent.setup().type(screen.getByLabelText("Password"), "example-password")
    await userEvent.setup().click(screen.getByRole("button", { name: "Log in" }))
    expect(await screen.findByRole("heading", { name: restrictedQuiz.title })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to Quiz Set" }).getAttribute("href")).toBe(`/app/practice/general/sets/${quizSet.id}`)
    expect(startGeneralPracticeSession).not.toHaveBeenCalled()
  })

  it("opens a Public quiz from its Set and validates its parent on reload", async () => {
    renderRoutes(`/practice/general/sets/${quizSet.id}`)
    await userEvent.setup().click(await screen.findByRole("link", { name: `View details for ${publicQuiz.title}` }))
    expect(await screen.findByRole("link", { name: "Back to Quiz Set" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to Quiz Set" }).getAttribute("href")).toBe(`/practice/general/sets/${quizSet.id}`)
  })

  it("shows coming soon for an empty Active Set", async () => {
    fetchGeneralPracticeSet.mockResolvedValue({ set: quizSet, quizzes: [] })
    renderRoutes(`/practice/general/sets/${quizSet.id}`)
    expect(await screen.findByText("Quizzes coming soon")).toBeTruthy()
    expect(screen.getByText("Thai Practice").closest("div").querySelector(".lucide-book-open-text")).toBeTruthy()
  })

  it("renders authenticated Set details and handles a broken cover image", async () => {
    auth.isAuthenticated = true
    auth.user = { role: "user" }
    fetchGeneralPracticeSet.mockResolvedValue({ set: { ...quizSet, coverImage: "https://example.test/cover.jpg" }, quizzes: [publicQuiz, restrictedQuiz] })
    renderRoutes(`/app/practice/general/sets/${quizSet.id}`)
    const image = await screen.findByRole("img", { name: `${quizSet.name} cover image` })
    fireEvent.error(image)
    expect(screen.queryByRole("img", { name: `${quizSet.name} cover image` })).toBeNull()
    expect(screen.getByText("Thai Practice")).toBeTruthy()
    expect(screen.getByRole("link", { name: `View details for ${restrictedQuiz.title}` }).getAttribute("href")).toBe(`/app/practice/general/${restrictedQuiz.id}?setId=${quizSet.id}`)
  })

  it("handles unavailable, malformed, failed and retried Set details without leaking cards", async () => {
    fetchGeneralPracticeSet.mockRejectedValueOnce(Object.assign(new Error("missing"), { status: 404 }))
    const view = renderRoutes(`/practice/general/sets/bad-id`)
    expect((await screen.findByRole("alert")).textContent).toContain("no longer available")
    expect(screen.queryByText(restrictedQuiz.title)).toBeNull()
    view.unmount()
    fetchGeneralPracticeSet.mockRejectedValueOnce(new Error("offline"))
    renderRoutes(`/practice/general/sets/${quizSet.id}`)
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load")
    expect(screen.queryByText("Quizzes coming soon")).toBeNull()
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("heading", { name: quizSet.name })).toBeTruthy()
  })

  it("falls back to existing direct quiz navigation when Set context is absent or invalid", async () => {
    const view = renderRoutes(`/practice/general/${publicQuiz.id}`)
    expect(await screen.findByRole("link", { name: "Back to Home" })).toBeTruthy()
    expect(fetchGeneralPracticeSet).not.toHaveBeenCalled()
    view.unmount()
    renderRoutes(`/practice/general/${publicQuiz.id}?setId=6acc46dbad4ace5e3d908d2f`)
    expect(await screen.findByRole("heading", { name: publicQuiz.title })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Back to Quiz Set" })).toBeNull()
  })
  it("shows the public Quiz Set catalog without quiz metadata", async () => {
    renderRoutes()
    expect(await screen.findByText("Thai greetings Set")).toBeTruthy()
    expect(screen.queryByText("Private review")).toBeNull()
    expect(within(screen.getByRole("heading", { name: quizSet.name }).closest("article")).getByText("Beginner")).toBeTruthy()
    expect(screen.getByText("Public footer")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to Home" }).getAttribute("href")).toBe("/")
    expect(screen.getByRole("link", { name: `View Quiz Set ${quizSet.name}` }).getAttribute("href")).toBe(`/practice/general/sets/${quizSet.id}`)
    expect(startGeneralPracticeSession).not.toHaveBeenCalled()
  })

  it("returns a guest to protected quiz details after login without creating a session", async () => {
    renderRoutes(`/practice/general/${publicQuiz.id}`)
    expect(await screen.findByRole("heading", { name: "Thai greetings" })).toBeTruthy()
    expect(screen.getByText("Public").querySelector(".lucide-globe")).toBeTruthy()
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
    fetchGeneralPracticeSets.mockResolvedValueOnce({ sets: [], pageSize: 10, nextCursor: null })
    const view = renderRoutes()
    expect(await screen.findByText("No Quiz Sets available yet")).toBeTruthy()
    view.unmount()
    fetchGeneralPracticeSets.mockRejectedValueOnce(new Error("Unavailable"))
    renderRoutes()
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load")
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Thai greetings Set")).toBeTruthy()
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
