import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import Practice from "./Practice"
import StudentPractice from "./StudentPractice"
import StudentFlashcardsHub from "./StudentFlashcardsHub"

vi.mock("../components/Navbar", () => ({ default: () => <nav>Public navigation</nav> }))
vi.mock("../components/Footer", () => ({ default: () => <footer>Public footer</footer> }))
vi.mock("../components/Seo", () => ({ default: () => null }))
vi.mock("../components/ThaiAlphabetPractice", () => ({ default: () => <section>Consonant activity</section> }))
vi.mock("../components/ThaiVowelPractice", () => ({ default: () => <section>Vowel activity</section> }))

describe("Student Practice layout and back navigation", () => {
  it("keeps the overview as the hub without adding a back link", () => {
    render(<MemoryRouter><StudentPractice /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Practice Thai your way." })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Back to Practice Overview" })).toBeNull()
    expect(screen.getByRole("link", { name: /Thai consonants/i })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Thai vowels/i })).toBeTruthy()
  })

  it("returns from the Flashcards landing page to Practice Overview", async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={["/app/practice/flashcards"]}><Routes>
      <Route path="/app/practice/flashcards" element={<StudentFlashcardsHub />} />
      <Route path="/app/practice" element={<StudentPractice />} />
    </Routes></MemoryRouter>)
    await user.click(screen.getByRole("link", { name: "Back to Practice Overview" }))
    expect(screen.getByRole("heading", { name: "Practice Thai your way." })).toBeTruthy()
  })

  it.each([
    ["/app/practice/thai-consonants", "Consonant activity"],
    ["/app/practice/thai-vowels", "Vowel activity"],
  ])("uses the Student shell for %s and returns to the hub", async (path, activity) => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/app/practice/:section" element={<Practice />} />
      <Route path="/app/practice" element={<StudentPractice />} />
    </Routes></MemoryRouter>)
    expect(screen.getByText(activity)).toBeTruthy()
    expect(screen.queryByText("Public navigation")).toBeNull()
    expect(screen.queryByText("Public footer")).toBeNull()
    await user.click(screen.getByRole("link", { name: "Back to Practice Overview" }))
    expect(screen.getByRole("heading", { name: "Practice Thai your way." })).toBeTruthy()
  })

  it("leaves the public Practice page shell unchanged", () => {
    render(<MemoryRouter initialEntries={["/practice/thai-consonants"]}><Routes>
      <Route path="/practice/:section" element={<Practice />} />
    </Routes></MemoryRouter>)
    expect(screen.getByText("Public navigation")).toBeTruthy()
    expect(screen.getByText("Public footer")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Back to Practice Overview" })).toBeNull()
  })
})
