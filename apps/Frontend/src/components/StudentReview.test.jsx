import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentReview from "./StudentReview";

vi.mock("../services/testimonialService", () => ({ fetchTestimonials: vi.fn() }));
import { fetchTestimonials } from "../services/testimonialService";

describe("StudentReview", () => {
  it("withholds the section while loading and renders genuine API testimonials as text", async () => {
    let resolve; fetchTestimonials.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { container } = render(<StudentReview />); expect(container.innerHTML).toBe("");
    resolve([{ id: "one", quote: "<strong>Practical</strong> Thai lessons", displayName: "Htet" }, { id: "two", quote: "မြန်မာစာသား အတွေ့အကြုံ", displayName: "Anonymous learner" }]);
    expect(await screen.findByText("Htet")).toBeTruthy(); expect(screen.getByText("Anonymous learner")).toBeTruthy(); expect(screen.getByText(/<strong>Practical/)).toBeTruthy(); expect(screen.queryByLabelText(/stars/i)).toBeNull(); expect(screen.queryByText("Maya R.")).toBeNull();
  });

  it("hides the section for zero results or an API failure", async () => {
    fetchTestimonials.mockResolvedValueOnce([]); const empty = render(<StudentReview />); await waitFor(() => expect(empty.container.innerHTML).toBe("")); empty.unmount();
    fetchTestimonials.mockRejectedValueOnce(new Error("network")); const failed = render(<StudentReview />); await waitFor(() => expect(failed.container.innerHTML).toBe(""));
  });

  it("uses an approved image only when supplied by the public API and otherwise uses safe name or anonymous fallbacks", async () => {
    fetchTestimonials.mockResolvedValueOnce([
      { id: "photo", quote: "Photo-approved feedback", displayName: "Htet", profileImage: "https://cdn.example.test/approved.jpg" },
      { id: "initial", quote: "Name-only feedback", displayName: "Lina", profileImage: null },
      { id: "anonymous", quote: "Anonymous feedback", displayName: "Anonymous learner", profileImage: null },
    ]);
    render(<StudentReview />);
    const approved = await screen.findByAltText("");
    expect(approved.getAttribute("src")).toBe("https://cdn.example.test/approved.jpg");
    expect(screen.getByText("L")).toBeTruthy();
    expect(screen.getByText("Anonymous learner")).toBeTruthy();
  });
});
