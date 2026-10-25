import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import GeneralPracticeList from "./GeneralPracticeList"

vi.mock("../services/generalPracticeService", () => ({ fetchGeneralPracticeSets: vi.fn() }))
import { fetchGeneralPracticeSets } from "../services/generalPracticeService"

const set = { id: "set-1", name: "Thai greetings", description: "Practice daily greetings.",
  coverImage: "https://res.cloudinary.com/example/image/upload/cover.jpg", difficulty: "Beginner", displayOrder: 1 }
const page = (sets, nextCursor = null) => ({ sets, pageSize: 10, nextCursor })
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function Pathname() { return <output data-testid="path">{useLocation().pathname}</output> }
function renderCatalog(path = "/app/practice/general") {
  return render(<MemoryRouter initialEntries={[path]}><Pathname /><Routes>
    <Route path="/app/practice/general" element={<GeneralPracticeList />} />
    <Route path="/app/practice/general/sets/:setId" element={<p>Student Quiz Set details</p>} />
    <Route path="/app/practice/general/:quizId" element={<p>Existing student quiz details</p>} />
    <Route path="/app/practice/general/:quizId/take" element={<p>Existing quiz taking</p>} />
  </Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchGeneralPracticeSets.mockResolvedValue(page([set]))
})

describe("General Practice Quiz Set catalog", () => {
  it("loads Active Set cards for signed-in students", async () => {
    const path = "/app/practice/general"
    renderCatalog(path)
    expect(screen.getByText("Loading Quiz Sets...")).toBeTruthy()
    const card = (await screen.findByRole("heading", { name: set.name })).closest("article")
    expect(within(card).getByText(set.description)).toBeTruthy()
    expect(within(card).getByText(set.description).className).toContain("line-clamp-3")
    expect(within(card).getByText("Beginner")).toBeTruthy()
    expect(within(card).getByRole("img", { name: "Thai greetings cover image" })).toBeTruthy()
    expect(fetchGeneralPracticeSets).toHaveBeenCalledWith({ name: "", difficulty: "" })
    expect(screen.getByRole("link", { name: "Back to Practice Overview" })).toBeTruthy()
    const action = within(card).getByRole("link", { name: `View Quiz Set ${set.name}` })
    await userEvent.setup().click(action)
    expect(screen.getByTestId("path").textContent).toBe(`${path}/sets/${set.id}`)
    expect(screen.getByText("Student Quiz Set details")).toBeTruthy()
  })

  it("uses a stable branded fallback for missing and failed cover images", async () => {
    fetchGeneralPracticeSets.mockResolvedValue(page([set, { ...set, id: "set-2", name: "Thai tones", coverImage: "" }]))
    renderCatalog()
    const image = await screen.findByRole("img", { name: "Thai greetings cover image" })
    const fallback = screen.getByRole("heading", { name: "Thai tones" }).closest("article")
    expect(within(fallback).queryByRole("img")).toBeNull()
    expect(within(fallback).getByText("Thai Practice")).toBeTruthy()
    fireEvent.error(image)
    expect(screen.queryByRole("img", { name: "Thai greetings cover image" })).toBeNull()
    expect(screen.getAllByText("Thai Practice")).toHaveLength(2)
  })

  it("keeps the shared dropdown keyboard-accessible and restores focus on Escape", async () => {
    renderCatalog()
    await screen.findByRole("heading", { name: set.name })
    const trigger = screen.getByRole("button", { name: "Difficulty" })
    trigger.focus()
    await userEvent.setup().keyboard("{Enter}")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("listbox", { name: "Difficulty" })).toBeTruthy()
    await userEvent.setup().keyboard("{Escape}")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("listbox", { name: "Difficulty" })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("combines debounced name search with difficulty and resets the cursor", async () => {
    fetchGeneralPracticeSets.mockResolvedValueOnce(page([set], "next-1"))
      .mockResolvedValueOnce(page([{ ...set, id: "set-2", name: "Thai vowels" }]))
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([set]))
    renderCatalog()
    await screen.findByRole("heading", { name: set.name })
    expect(screen.getByRole("searchbox", { name: "Search Quiz Sets by name" }).className).toContain("h-12")
    const difficultyTrigger = screen.getByRole("button", { name: "Difficulty" })
    expect(difficultyTrigger.getAttribute("aria-haspopup")).toBe("listbox")
    expect(difficultyTrigger.className).toContain("h-12")
    expect(difficultyTrigger.querySelector(".lucide-chevron-down")).toBeTruthy()
    await userEvent.setup().click(difficultyTrigger)
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["All Levels", "Beginner", "Intermediate", "Advanced"])
    await userEvent.setup().click(screen.getByRole("option", { name: "Intermediate" }))
    expect(await screen.findByRole("heading", { name: "Thai vowels" })).toBeTruthy()
    expect(fetchGeneralPracticeSets).toHaveBeenNthCalledWith(2, { name: "", difficulty: "Intermediate" })
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search Quiz Sets by name" }), "tones")
    expect(await screen.findByText("No Quiz Sets match your search")).toBeTruthy()
    expect(fetchGeneralPracticeSets).toHaveBeenNthCalledWith(3, { name: "tones", difficulty: "Intermediate" })
    expect(fetchGeneralPracticeSets.mock.calls[2][0]).not.toHaveProperty("after")
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear filters" }))
    expect(await screen.findByRole("heading", { name: set.name })).toBeTruthy()
    expect(fetchGeneralPracticeSets).toHaveBeenNthCalledWith(4, { name: "", difficulty: "" })
  })

  it("uses nextCursor, keeps Backend order, deduplicates cards and blocks parallel page requests", async () => {
    const second = deferred()
    fetchGeneralPracticeSets.mockResolvedValueOnce(page([set], "next-1")).mockReturnValueOnce(second.promise)
    renderCatalog()
    await screen.findByRole("heading", { name: set.name })
    const load = screen.getByRole("button", { name: "Load more Quiz Sets" })
    fireEvent.click(load)
    fireEvent.click(load)
    expect(fetchGeneralPracticeSets).toHaveBeenCalledTimes(2)
    expect(fetchGeneralPracticeSets).toHaveBeenNthCalledWith(2, { name: "", difficulty: "", after: "next-1" })
    await act(async () => second.resolve(page([{ ...set }, { ...set, id: "set-2", name: "Thai tones" }])) )
    expect(screen.getAllByRole("article")).toHaveLength(2)
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Thai greetings", "Thai tones"])
    expect(screen.queryByRole("button", { name: "Load more Quiz Sets" })).toBeNull()
  })

  it("ignores an older response after filters change", async () => {
    const old = deferred()
    fetchGeneralPracticeSets.mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([{ ...set, id: "set-2", name: "Advanced tones" }]))
    renderCatalog()
    await userEvent.setup().click(screen.getByRole("button", { name: "Difficulty" }))
    await userEvent.setup().click(screen.getByRole("option", { name: "Advanced" }))
    expect(await screen.findByRole("heading", { name: "Advanced tones" })).toBeTruthy()
    await act(async () => old.resolve(page([set])) )
    expect(screen.queryByRole("heading", { name: set.name })).toBeNull()
  })

  it("distinguishes an empty catalog from no filtered matches and an API failure", async () => {
    fetchGeneralPracticeSets.mockResolvedValueOnce(page([]))
    const view = renderCatalog()
    expect(await screen.findByText("No Quiz Sets available yet")).toBeTruthy()
    view.unmount()
    fetchGeneralPracticeSets.mockRejectedValueOnce(new Error("offline"))
    renderCatalog()
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load")
    expect(screen.queryByText("No Quiz Sets available yet")).toBeNull()
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("heading", { name: set.name })).toBeTruthy()
  })

  it("retains existing cards and cursor when a later page fails, then retries it", async () => {
    fetchGeneralPracticeSets.mockResolvedValueOnce(page([set], "next-1"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page([{ ...set, id: "set-2", name: "Thai tones" }]))
    renderCatalog()
    await screen.findByRole("heading", { name: set.name })
    await userEvent.setup().click(screen.getByRole("button", { name: "Load more Quiz Sets" }))
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't load more")
    expect(screen.getByRole("heading", { name: set.name })).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry loading more" }))
    expect(await screen.findByRole("heading", { name: "Thai tones" })).toBeTruthy()
    expect(fetchGeneralPracticeSets).toHaveBeenNthCalledWith(3, { name: "", difficulty: "", after: "next-1" })
  })

  it("preserves direct quiz-detail and taking URLs", () => {
    const view = renderCatalog("/app/practice/general/quiz-1")
    expect(screen.getByText("Existing student quiz details")).toBeTruthy()
    view.unmount()
    renderCatalog("/app/practice/general/quiz-1/take")
    expect(screen.getByText("Existing quiz taking")).toBeTruthy()
    expect(fetchGeneralPracticeSets).not.toHaveBeenCalled()
  })
})
