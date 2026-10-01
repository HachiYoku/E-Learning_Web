import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import StudentSupport from "./StudentSupport"

vi.mock("../services/supportTicketService", () => ({
  createSupportTicket: vi.fn(),
  fetchMySupportTickets: vi.fn(),
  replyToSupportTicket: vi.fn(),
}))

import { fetchMySupportTickets } from "../services/supportTicketService"

function renderSupport(path = "/app/support") {
  return render(<MemoryRouter initialEntries={[path]}><StudentSupport /></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchMySupportTickets.mockResolvedValue([])
})

describe("StudentSupport payment preselection", () => {
  it("opens with valid payment order-status values and an empty message", async () => {
    renderSupport("/app/support?category=payment&subject=Order+status")

    expect(await screen.findByRole("heading", { name: "Send a support request" })).toBeTruthy()
    expect(screen.getByLabelText("Topic").textContent).toContain("Payment or order")
    expect(screen.getByLabelText("Subject").textContent).toContain("Order status")
    expect(screen.getByLabelText("Message").value).toBe("")
  })

  it("lets a student change valid preselected fields", async () => {
    renderSupport("/app/support?category=payment&subject=Payment+issue")

    const topic = await screen.findByLabelText("Topic")
    fireEvent.click(topic)
    fireEvent.click(screen.getByRole("option", { name: "Technical problem" }))
    expect(screen.getByLabelText("Subject").textContent).toContain("Cannot sign in")
    fireEvent.click(screen.getByLabelText("Subject"))
    fireEvent.click(screen.getByRole("option", { name: "Website issue" }))
    expect(screen.getByLabelText("Subject").textContent).toContain("Website issue")
  })

  it.each([
    "/app/support?category=unknown&subject=Order+status",
    "/app/support?category=payment&subject=Unknown",
    "/app/support?category=course&subject=Payment+issue",
  ])("falls back to the ordinary form for invalid values", async (path) => {
    renderSupport(path)

    await screen.findByText("No support requests yet")
    expect(screen.queryByRole("heading", { name: "Send a support request" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "New request" }))
    expect(screen.getByLabelText("Topic").textContent).toContain("General support")
    expect(screen.getByLabelText("Subject").textContent).toContain("General question")
    expect(screen.getByLabelText("Message").value).toBe("")
  })

  it("keeps normal support navigation unchanged", async () => {
    renderSupport()

    await screen.findByText("No support requests yet")
    expect(screen.queryByRole("heading", { name: "Send a support request" })).toBeNull()
  })
})
