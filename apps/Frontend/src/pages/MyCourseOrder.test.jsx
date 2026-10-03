import { act, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MyCourseOrder from "./MyCourseOrder"

vi.mock("../services/paymentService", () => ({ fetchMyPayments: vi.fn(), emailPaymentReceipt: vi.fn() }))
vi.mock("../components/Navbar", () => ({ default: () => null }))
vi.mock("../components/Footer", () => ({ default: () => null }))

import { emailPaymentReceipt, fetchMyPayments } from "../services/paymentService"

const payment = {
  id: "payment-1", status: "pending", createdAt: "2026-10-01T00:00:00.000Z",
  course: { id: "course-1", title: "Thai Foundations", description: "Learn Thai", price: "฿4,500", image: "" },
  paymentMethod: { name: "Bank transfer", type: "bank_transfer" },
}

beforeEach(() => vi.resetAllMocks())

describe("MyCourseOrder Payment Reference", () => {
  it("shows a secondary Payment Reference only when one exists", async () => {
    fetchMyPayments.mockResolvedValue([{ ...payment, paymentReference: "PAY-7KQ4M9DX" }])
    render(<MemoryRouter><MyCourseOrder /></MemoryRouter>)
    expect(await screen.findByText("PAY-7KQ4M9DX")).toBeTruthy()
    expect(screen.getByText("Payment Reference:")).toBeTruthy()
  })

  it("omits a legacy missing Payment Reference", async () => {
    fetchMyPayments.mockResolvedValue([payment])
    render(<MemoryRouter><MyCourseOrder /></MemoryRouter>)
    expect(await screen.findByText("Thai Foundations")).toBeTruthy()
    expect(screen.queryByText("Payment Reference:")).toBeNull()
  })

  it("offers a confirmation before emailing an approved payment receipt", async () => {
    fetchMyPayments.mockResolvedValue([{ ...payment, status: "approved", paymentReference: "PAY-7KQ4M9DX" }])
    render(<MemoryRouter><MyCourseOrder /></MemoryRouter>)
    expect(await screen.findByRole("button", { name: "Email receipt" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Email receipt" }))
    expect(screen.getByRole("heading", { name: "Email payment receipt?" })).toBeTruthy()
    expect(screen.queryByText(/per 24 hours/i)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }))
    expect(emailPaymentReceipt).toHaveBeenCalledWith("payment-1")
  })

  it("moves from sending to success without a delayed availability timer", async () => {
    fetchMyPayments.mockResolvedValue([{ ...payment, status: "approved", paymentReference: "PAY-7KQ4M9DX" }])
    emailPaymentReceipt.mockResolvedValue(undefined)
    render(<MemoryRouter><MyCourseOrder /></MemoryRouter>)
    fireEvent.click(await screen.findByRole("button", { name: "Email receipt" }))
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }))
    expect(screen.getByRole("heading", { name: "Sending your receipt…" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
    await act(async () => { await Promise.resolve() })
    expect(screen.getAllByText("Receipt sent").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy()
  })

  it("shows the friendly lifetime-limit support state instead of an internal-server error", async () => {
    fetchMyPayments.mockResolvedValue([{ ...payment, status: "approved", paymentReference: "PAY-7KQ4M9DX" }])
    emailPaymentReceipt.mockRejectedValue(Object.assign(new Error("Internal server error"), { code: "receipt_limit_reached" }))
    render(<MemoryRouter><MyCourseOrder /></MemoryRouter>)
    fireEvent.click(await screen.findByRole("button", { name: "Email receipt" }))
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }))
    expect(await screen.findByText("Receipt email limit reached. Contact support if you need another copy.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Contact support" })).toBeTruthy()
    expect(screen.queryByText("Internal server error")).toBeNull()
  })
})
