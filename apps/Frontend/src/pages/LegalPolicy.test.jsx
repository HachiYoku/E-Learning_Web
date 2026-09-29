import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RouteMetadata } from "../App";
import { CookiePolicy, PrivacyPolicy } from "./LegalPolicy";

vi.mock("../components/Navbar", () => ({ default: () => <nav>Public navigation</nav> }));

describe("legal policy pages", () => {
  it("renders a transparent privacy-policy shell", () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByText(/approved privacy-policy wording is being prepared/i)).toBeTruthy();
    expect(screen.getByText(/owner and legal review/i)).toBeTruthy();
  });

  it("renders a transparent cookie-policy shell", () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Cookie Policy" })).toBeTruthy();
    expect(screen.getByText(/approved cookie-policy wording is being prepared/i)).toBeTruthy();
  });

  it("keeps incomplete legal routes public but out of search indexes", () => {
    render(<MemoryRouter initialEntries={["/privacy-policy"]}><RouteMetadata /></MemoryRouter>);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
  });
});
