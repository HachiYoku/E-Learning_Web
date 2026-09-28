import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Footer from "./Footer";

function renderFooter(path = "/") {
  return render(<MemoryRouter initialEntries={[path]}><Footer /></MemoryRouter>);
}

describe("Footer", () => {
  it("links to real public legal routes with touch-safe link controls", () => {
    renderFooter();

    const privacy = screen.getByRole("link", { name: "Privacy Policy" });
    const cookies = screen.getByRole("link", { name: "Cookie Policy" });
    expect(privacy.getAttribute("href")).toBe("/privacy-policy");
    expect(cookies.getAttribute("href")).toBe("/cookie-policy");
    expect(privacy.className).toContain("min-h-11");
    expect(cookies.className).toContain("min-h-11");
  });

  it("remains absent inside the student application", () => {
    renderFooter("/app/courses");
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });
});
