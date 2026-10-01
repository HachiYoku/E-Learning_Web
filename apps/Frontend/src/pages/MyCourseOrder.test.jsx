import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MyCourseOrder from "./MyCourseOrder"

vi.mock("../services/paymentService", () => ({ fetchMyPayments: vi.fn() }))
vi.mock("../components/Navbar", () => ({ default: () => null }))
vi.mock("../components/Footer", () => ({ default: () => null }))

import { fetchMyPayments } from "../services/paymentService"

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
})
