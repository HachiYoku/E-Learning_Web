import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Hero from "./Hero";

let authState = { isAuthenticated: false, isBootstrapping: false };

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

describe("Hero", () => {
  beforeEach(() => {
    authState = { isAuthenticated: false, isBootstrapping: false };
  });

  it("uses the English headline and scoped Burmese supporting copy", () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );

    expect(screen.getByText("Arun Thai Academy")).toBeTruthy();
    const headline = screen.getByRole("heading", { name: "Learn Thai with confidence, naturally." });

    expect(headline.getAttribute("lang")).toBeNull();
    expect(headline.className).not.toContain("font-myanmar");
    const description = screen.getByText((_, element) => (
      element?.tagName === "P"
      && element.textContent?.replace(/\s+/g, " ").trim()
        === "သင့်ရဲ့ ထိုင်းနိုင်ငံ ရည်မှန်းချက်တွေအတွက် အစပျိုးရာ — ထိုင်းစာ၊ ထိုင်းစကားကို အချိန်မရွေး လွယ်ကူစွာ လေ့ကျင့်လိုက်ပါ။"
    ));
    const helper = screen.getByText("ထိုင်းစာကို အခြေခံမှ စတင်လေ့လာနိုင်ပါပြီ။");

    expect(description.getAttribute("lang")).toBe("my");
    expect(description.className).toContain("w-full");
    expect(description.className).toContain("max-[399px]:w-[calc(100%+1rem)]");
    expect(description.className).not.toContain("lg:w-[calc(100%+4rem)]");
    expect(screen.getByLabelText("Focus on everyday Thai").className).toContain("lg:block");
    expect(screen.getByLabelText("Focus on everyday Thai").className).not.toContain("md:block");
    expect(screen.getByText("ထိုင်းစာ၊ ထိုင်းစကားကို အချိန်မရွေး လွယ်ကူစွာ လေ့ကျင့်လိုက်ပါ။").className).not.toContain("whitespace-nowrap");
    expect(helper.getAttribute("lang")).toBe("my");
    expect(helper.className).toContain("w-full");
    expect(screen.getByRole("link", { name: /Explore Courses/i }).getAttribute("href")).toBe("/courses");
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login");
  });

  it("shows My Learning for authenticated students", () => {
    authState = { isAuthenticated: true, isBootstrapping: false };
    render(<MemoryRouter><Hero /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "My Learning" }).getAttribute("href")).toBe("/app");
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });

  it("does not show a guest CTA while authentication is initializing", () => {
    authState = { isAuthenticated: false, isBootstrapping: true };
    render(<MemoryRouter><Hero /></MemoryRouter>);

    expect(screen.getByRole("link", { name: /Explore Courses/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My Learning" })).toBeNull();
  });
});
