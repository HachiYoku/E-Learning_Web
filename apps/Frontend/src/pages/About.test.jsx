import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../components/Navbar", () => ({ default: () => null }));
vi.mock("../components/StudentReview", () => ({ default: () => null }));
vi.mock("../components/ContactSection", () => ({ default: () => null }));
vi.mock("../components/Footer", () => ({ default: () => null }));
vi.mock("../components/Seo", () => ({ default: () => null }));

import About from "./About";

describe("About", () => {
  it("opens the shared contact chooser from Get in touch", () => {
    render(<About />);

    const trigger = screen.getByRole("button", { name: /get in touch/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: /let's talk/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /close contact options/i }));
    expect(screen.queryByRole("dialog", { name: /let's talk/i })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
