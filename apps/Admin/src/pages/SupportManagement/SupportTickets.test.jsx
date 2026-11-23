import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SupportTickets from "./SupportTickets"

vi.mock("../../services/supportTicketService", () => ({
  fetchSupportTickets: vi.fn(),
  replyToSupportTicket: vi.fn(),
  updateSupportTicketStatus: vi.fn(),
}))

import { fetchSupportTickets, replyToSupportTicket, updateSupportTicketStatus } from "../../services/supportTicketService"

const ticket = {
  _id: "ticket-1",
  category: "payment",
  subject: "Payment question",
  message: "Original student message.",
  status: "open",
  createdAt: "2026-10-02T08:45:00.000Z",
  studentId: { name: "Student", email: "student@example.test" },
  replies: [
    { _id: "reply-1", authorRole: "user", message: "Student follow-up.", createdAt: "2026-10-02T09:15:00.000Z" },
    { _id: "reply-2", authorRole: "admin", message: "Admin response.", createdAt: "2026-10-02T10:30:00.000Z" },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchSupportTickets.mockResolvedValue([ticket])
})

describe("SupportTickets timestamps", () => {
  it("shows selected-request timestamps in Bangkok time and omits them from the request list", async () => {
    render(<SupportTickets />)

    expect(await screen.findByText("Submitted: 02/10/2026, 15:45")).toBeTruthy()
    expect(screen.getByText("02/10/2026, 15:45")).toBeTruthy()
    expect(screen.getByText("02/10/2026, 16:15")).toBeTruthy()
    expect(screen.getByText("02/10/2026, 17:30")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Payment question/i }).textContent).not.toMatch(/02\/10\/2026/)
  })

  it("hides unavailable timestamps and preserves reply submission and status updates", async () => {
    const missingTimestampTicket = {
      ...ticket,
      createdAt: null,
      replies: [
        { _id: "reply-1", authorRole: "user", message: "Student follow-up.", createdAt: "invalid-date" },
        { _id: "reply-2", authorRole: "admin", message: "Admin response.", createdAt: undefined },
      ],
    }
    fetchSupportTickets.mockResolvedValue([missingTimestampTicket])
    updateSupportTicketStatus.mockResolvedValue({ ...missingTimestampTicket, status: "in_progress" })
    replyToSupportTicket.mockResolvedValue({ ...missingTimestampTicket, replies: [...missingTimestampTicket.replies, { _id: "reply-3", authorRole: "admin", message: "New response.", createdAt: null }] })

    render(<SupportTickets />)

    expect((await screen.findAllByText("Original student message.")).length).toBe(2)
    expect(screen.queryByText(/Submitted:/)).toBeNull()
    expect(screen.queryByText("Invalid Date")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    fireEvent.click(screen.getByRole("option", { name: "In progress" }))
    await waitFor(() => expect(updateSupportTicketStatus).toHaveBeenCalledWith("ticket-1", "in_progress"))
    fireEvent.change(screen.getByLabelText("Reply to student"), { target: { value: "New response." } })
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }))
    await waitFor(() => expect(replyToSupportTicket).toHaveBeenCalledWith("ticket-1", "New response."))
  })
})
