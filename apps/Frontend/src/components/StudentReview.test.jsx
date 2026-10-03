import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StudentReview from "./StudentReview";

vi.mock("../services/testimonialService", () => ({ fetchTestimonials: vi.fn() }));
import { fetchTestimonials } from "../services/testimonialService";

function setViewport(width) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  fireEvent(window, new Event("resize"));
}

function testimonials(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `testimonial-${index + 1}`,
    quote: `Feedback ${index + 1}`,
    displayName: `Student ${index + 1}`,
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  setViewport(1024);
});

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

  it("shows an accessible expansion control only when a testimonial is visually truncated", async () => {
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return this.dataset?.testid === "testimonial-quote-long" ? 200 : 100;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 100;
      },
    });

    try {
      fetchTestimonials.mockResolvedValueOnce([
        { id: "short", quote: "A short testimonial.", displayName: "Lina" },
        { id: "long", quote: "A much longer testimonial that should be expandable when it overflows the card's six-line preview area.", displayName: "Htet" },
      ]);
      render(<StudentReview />);

      const readMore = await screen.findByRole("button", { name: "Read more" });
      expect(screen.queryAllByRole("button", { name: "Read more" })).toHaveLength(1);
      expect(readMore.getAttribute("aria-expanded")).toBe("false");
      expect(readMore.getAttribute("aria-controls")).toBe("testimonial-long-quote");
      expect(screen.getByTestId("testimonial-quote-long").className).toContain("line-clamp-6");

      fireEvent.click(readMore);
      expect(screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByTestId("testimonial-quote-long").className).not.toContain("line-clamp-6");

      fireEvent.click(screen.getByRole("button", { name: "Show less" }));
      expect(screen.getByRole("button", { name: "Read more" }).getAttribute("aria-expanded")).toBe("false");
    } finally {
      if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
      else delete HTMLElement.prototype.scrollHeight;
      if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
      else delete HTMLElement.prototype.clientHeight;
    }
  });

  it("shows three cards on desktop, two on tablet, and one on mobile", async () => {
    const items = testimonials(4);
    fetchTestimonials.mockResolvedValue(items);

    const desktop = render(<StudentReview />);
    await screen.findByText(/Feedback 1/);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    desktop.unmount();

    setViewport(768);
    const tablet = render(<StudentReview />);
    await screen.findByText(/Feedback 1/);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    tablet.unmount();

    setViewport(320);
    render(<StudentReview />);
    await screen.findByText(/Feedback 1/);
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("hides pagination when all testimonials fit and provides accessible previous/next navigation when they do not", async () => {
    fetchTestimonials.mockResolvedValueOnce(testimonials(3));
    const onePage = render(<StudentReview />);
    await screen.findByText(/Feedback 1/);
    expect(screen.queryByLabelText("Testimonial pagination")).toBeNull();
    onePage.unmount();

    fetchTestimonials.mockResolvedValueOnce(testimonials(4));
    render(<StudentReview />);
    await screen.findByText(/Feedback 1/);
    expect(screen.getByLabelText("Testimonial pagination")).toBeTruthy();
    const previous = screen.getByRole("button", { name: "Previous" });
    const next = screen.getByRole("button", { name: "Next" });
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(await screen.findByText(/Feedback 4/)).toBeTruthy();
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);
  });

  it("clamps the visible page after a responsive page-size change", async () => {
    setViewport(320);
    fetchTestimonials.mockResolvedValue(testimonials(4));
    render(<StudentReview />);
    await screen.findByText(/Feedback 1/);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/Feedback 4/)).toBeTruthy();

    setViewport(1024);
    await screen.findByText(/Feedback 4/);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen
        .getByRole("button", { name: "Show testimonials page 2" })
        .getAttribute("aria-current")
    ).toBe("page");
  });
});
