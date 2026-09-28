import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MotivationBanner from "./MotivationBanner";

describe("MotivationBanner", () => {
  it("uses the Burmese quote with scoped Myanmar typography", () => {
    render(<MotivationBanner />);

    const quote = screen.getByRole("heading", { name: "သဘာဝကျကျ ထိုင်းစကား ပြောဆိုပြီး အောင်မြင်မှုကို ယုံကြည်ချက်ရှိရှိ ရယူလိုက်ပါ။" });

    expect(screen.getByText("A note for your journey")).toBeTruthy();
    expect(quote.getAttribute("lang")).toBe("my");
    expect(quote.className).toContain("font-myanmar");
    expect(quote.className).toContain("font-medium");
    expect(quote.className).toContain("leading-[1.62]");
    expect(quote.className).not.toContain("leading-snug");
    expect(screen.getByText("Speak Thai naturally, thrive confidently.")).toBeTruthy();
  });
});
