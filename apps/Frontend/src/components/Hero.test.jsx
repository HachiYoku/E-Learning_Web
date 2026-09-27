import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Hero from "./Hero";

describe("Hero", () => {
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
    expect(description.className).toContain("lg:w-[calc(100%+4rem)]");
    expect(helper.getAttribute("lang")).toBe("my");
    expect(helper.className).toContain("w-full");
    expect(screen.getByRole("button", { name: /Explore Courses/i })).toBeTruthy();
  });
});
