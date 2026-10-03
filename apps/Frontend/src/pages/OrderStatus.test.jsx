import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import OrderStatus from "./OrderStatus"

vi.mock("../services/paymentService", () => ({
  fetchMyPayments: vi.fn(),
  fetchRejectedPaymentProofBlob: vi.fn(),
}))
vi.mock("../components/Navbar", () => ({ default: () => null }))
vi.mock("../components/Footer", () => ({ default: () => null }))

import { fetchMyPayments } from "../services/paymentService"

const basePayment = {
  id: "payment-1",
  course: { id: "course-1", title: "Thai Foundations", image: "" },
  amount: 4500,
  currency: "THB",
  paymentMethod: { name: "Bank transfer", currency: "THB" },
  createdAt: "2026-09-01T10:00:00.000Z",
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}{location.search}</p>
}

function renderOrder(payment) {
  fetchMyPayments.mockResolvedValue([payment])
  return render(<MemoryRouter initialEntries={["/app/orders/payment-1"]}><Routes><Route path="/app/orders/:orderId" element={<><OrderStatus /><LocationProbe /></>} /><Route path="/app/support" element={<LocationProbe />} /></Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("OrderStatus payment support links", () => {
  it("shows a pending payment support link with order-status preselection", async () => {
    renderOrder({ ...basePayment, status: "pending" })

    expect(await screen.findByRole("heading", { name: "Waiting for review" })).toBeTruthy()
    const support = screen.getByRole("link", { name: "Get Help & Support" })
    expect(support.getAttribute("href")).toBe("/app/support?category=payment&subject=Order+status")
    fireEvent.click(support)
    expect(screen.getByTestId("location").textContent).toBe("/app/support?category=payment&subject=Order+status")
  })

  it("keeps resubmission primary and provides payment-issue support after rejection", async () => {
    renderOrder({ ...basePayment, status: "rejected", rejectReason: "Receipt is unreadable" })

    expect(await screen.findByRole("button", { name: "Submit a new payment" })).toBeTruthy()
    const support = screen.getByRole("link", { name: "Get Help & Support" })
    expect(support.getAttribute("href")).toBe("/app/support?category=payment&subject=Payment+issue")
    fireEvent.click(support)
    expect(screen.getByTestId("location").textContent).toBe("/app/support?category=payment&subject=Payment+issue")
  })

  it("does not add the payment support link to approved payments", async () => {
    renderOrder({ ...basePayment, status: "approved" })

    expect(await screen.findByRole("heading", { name: "You’re enrolled!" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Get Help & Support" })).toBeNull()
  })

  it("shows an available Payment Reference in every status view and copies only its value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    renderOrder({ ...basePayment, status: "pending", paymentReference: "PAY-7KQ4M9DX" })
    expect(await screen.findByText("PAY-7KQ4M9DX")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    expect(writeText).toHaveBeenCalledWith("PAY-7KQ4M9DX")
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy()
  })

  it("omits a missing legacy Payment Reference and keeps clipboard failures safe", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } })
    renderOrder({ ...basePayment, status: "approved" })
    expect(await screen.findByRole("heading", { name: "You’re enrolled!" })).toBeTruthy()
    expect(screen.queryByText("Payment Reference")).toBeNull()
  })
})
