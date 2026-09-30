import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RouteMetadata } from "../App";
import { CookiePolicy, PrivacyPolicy, Terms } from "./LegalPolicy";
import Register from "./Register";

vi.mock("../services/authService", () => ({ register: vi.fn() }));
vi.mock("../components/AuthShell", () => ({ default: ({ children }) => <main>{children}</main> }));

vi.mock("../components/Navbar", () => ({ default: () => <nav>Public navigation</nav> }));

describe("legal policy pages", () => {
  it("renders the privacy disclosure", () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByText(/MongoDB/)).toBeTruthy();
  });

  it("renders the cookie and local-storage disclosure", () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Cookie & Storage Policy" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "2. Browser Local Storage" })).toBeTruthy();
  });

  it("renders English-only terms in the shared wide document layout", () => {
    const { container } = render(<MemoryRouter><Terms /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Terms & Conditions" })).toBeTruthy();
    expect(container.querySelector(".legal-document")?.className).toContain("max-w-screen-xl");
    expect(container.textContent).not.toMatch(/[\u1000-\u109F]/);
    expect(container.textContent).not.toMatch(/Burmese version is (primary|controlling)/i);
  });

  it("keeps incomplete legal routes public but out of search indexes", () => {
    render(<MemoryRouter initialEntries={["/privacy-policy"]}><RouteMetadata /></MemoryRouter>);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
  });

  it("shows guardian permission only for the 13–17 registration selection", () => {
    render(<MemoryRouter><Register /></MemoryRouter>);
    expect(screen.queryByText(/parent or legal guardian/i)).toBeNull();
    screen.getByLabelText("I am 13–17").click();
    expect(screen.getByText(/parent or legal guardian/i)).toBeTruthy();
    screen.getByLabelText("I am 18 or older").click();
    expect(screen.queryByText(/parent or legal guardian/i)).toBeNull();
    expect(screen.queryByLabelText(/under 13/i)).toBeNull();
  });
});
