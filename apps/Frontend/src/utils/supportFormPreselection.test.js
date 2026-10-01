import { describe, expect, it } from "vitest"
import { defaultSupportForm, paymentSupportPath, supportFormPreselection } from "./supportFormPreselection"

describe("support form preselection", () => {
  it("accepts supported payment category and subject values with an empty message", () => {
    expect(supportFormPreselection(new URLSearchParams("category=payment&subject=Order+status"))).toEqual({
      category: "payment",
      subject: "Order status",
      message: "",
    })
    expect(supportFormPreselection(new URLSearchParams("category=payment&subject=Payment+issue"))).toEqual({
      category: "payment",
      subject: "Payment issue",
      message: "",
    })
  })

  it.each([
    "category=unknown&subject=Order+status",
    "category=payment&subject=Unknown",
    "category=course&subject=Payment+issue",
    "category=payment",
  ])("rejects invalid or incompatible values: %s", (query) => {
    expect(supportFormPreselection(new URLSearchParams(query))).toBeNull()
  })

  it("keeps the ordinary form default when no valid preselection is present", () => {
    expect(defaultSupportForm()).toEqual({ category: "general", subject: "General question", message: "" })
  })

  it("builds the internal payment-support route", () => {
    expect(paymentSupportPath("Order status")).toBe("/app/support?category=payment&subject=Order+status")
  })
})
