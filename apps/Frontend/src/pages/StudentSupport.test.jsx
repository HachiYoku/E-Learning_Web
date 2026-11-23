import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import StudentSupport from "./StudentSupport"

vi.mock("../services/supportTicketService", () => ({
  createSupportTicket: vi.fn(),
  fetchMySupportTickets: vi.fn(),
  replyToSupportTicket: vi.fn(),
}))

import { fetchMySupportTickets, replyToSupportTicket } from "../services/supportTicketService"
import { formatDateTime12Hour } from "../utils/dateTime"

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

describe("StudentSupport timestamps", () => {
  const ticket = {
    _id: "ticket-1",
    category: "course",
    subject: "Course access",
    message: "I cannot open my lesson.",
    status: "open",
    createdAt: "2026-10-02T08:45:00.000Z",
    updatedAt: "2026-10-03T08:45:00.000Z",
    replies: [
      { _id: "reply-1", authorRole: "user", message: "My student follow-up.", createdAt: "2026-10-02T09:15:00.000Z" },
      { _id: "reply-2", authorRole: "admin", message: "Our support reply.", createdAt: "2026-10-02T10:30:00.000Z" },
    ],
  }

  it("shows the request and each reply timestamp in the local 12-hour format", async () => {
    fetchMySupportTickets.mockResolvedValue([ticket])

    renderSupport()

    const submittedAt = formatDateTime12Hour(ticket.createdAt, "")
    expect(await screen.findByText(`Your request · ${submittedAt}`)).toBeTruthy()
    expect(screen.getByText(submittedAt)).toBeTruthy()
    expect(screen.getByText(formatDateTime12Hour(ticket.replies[0].createdAt, ""))).toBeTruthy()
    expect(screen.getByText(formatDateTime12Hour(ticket.replies[1].createdAt, ""))).toBeTruthy()
    expect(screen.getByText(formatDateTime12Hour(ticket.replies[1].createdAt, "")).textContent).toMatch(/AM|PM/)
  })

  it("hides invalid timestamps without changing messages, reply submission, or reopening", async () => {
    const resolvedTicket = {
      ...ticket,
      status: "resolved",
      createdAt: null,
      replies: [
        { _id: "reply-1", authorRole: "user", message: "Still need help.", createdAt: "invalid-date", updatedAt: ticket.updatedAt },
        { _id: "reply-2", authorRole: "admin", message: "We can help.", createdAt: undefined, updatedAt: ticket.updatedAt },
      ],
    }
    fetchMySupportTickets.mockResolvedValue([resolvedTicket])
    replyToSupportTicket.mockResolvedValue({ ...resolvedTicket, status: "open" })

    renderSupport()

    expect(await screen.findByText("Still need help.")).toBeTruthy()
    expect(screen.getByText("We can help.")).toBeTruthy()
    expect(screen.queryByText(/Your request ·/)).toBeNull()
    expect(screen.queryByText("Invalid Date")).toBeNull()
    expect(screen.queryByText(ticket.updatedAt)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Reopen request" }))
    fireEvent.change(screen.getByLabelText("Reply to support"), { target: { value: "Please reopen this." } })
    fireEvent.click(screen.getByRole("button", { name: "Reopen and send" }))
    await waitFor(() => expect(replyToSupportTicket).toHaveBeenCalledWith("ticket-1", "Please reopen this."))
  })
})
