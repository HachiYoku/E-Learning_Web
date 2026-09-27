import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Article from "./Article";

vi.mock("../services/blogService", () => ({
  fetchBlogs: vi.fn(() => new Promise(() => {})),
}));

describe("Article", () => {
  it("uses Burmese only for the static explanatory introduction", () => {
    render(
      <MemoryRouter>
        <Article />
      </MemoryRouter>,
    );

    const description = screen.getByText((_, element) => (
      element?.tagName === "P"
      && element.getAttribute("lang") === "my"
      && element.className.includes("font-myanmar")
    ));

    expect(screen.getByText("From our journal")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Thai Learning Insights." })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Explore all articles/i })).toBeTruthy();
    expect(description.getAttribute("lang")).toBe("my");
    expect(description.className).toContain("font-myanmar");
    expect(screen.getByText("Loading articles...")).toBeTruthy();
  });
});
