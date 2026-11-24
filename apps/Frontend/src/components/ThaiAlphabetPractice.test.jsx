import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ThaiAlphabetPractice from "./ThaiAlphabetPractice"

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
})

describe("ThaiAlphabetPractice special ร combinations", () => {
  it("keeps only สร, ศร, and ทร in order with a three-column selector", () => {
    render(<ThaiAlphabetPractice />)

    const specialButtons = [
      screen.getByRole("button", { name: "สร, read as ส" }),
      screen.getByRole("button", { name: "ศร, read as ส" }),
      screen.getByRole("button", { name: "ทร, read as ซ" }),
    ]
    expect(specialButtons.map((button) => button.textContent)).toEqual(["สร", "ศร", "ทร"])
    expect(screen.queryByRole("button", { name: /^จร,/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /^ซร,/ })).toBeNull()
    expect(specialButtons[0].parentElement.className).toContain("grid-cols-3")
    expect(specialButtons[0].parentElement.className).toContain("sm:grid-cols-3")
  })

  it("keeps the remaining selection, description, and audio mapping intact", () => {
    render(<ThaiAlphabetPractice />)

    fireEvent.click(screen.getByRole("button", { name: "ทร, read as ซ" }))

    expect(screen.getByText("Read as ซ")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Hear ทราบ" })).toBeTruthy()
  })
})
