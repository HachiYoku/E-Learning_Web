import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Benefits from "./Benefits";

describe("Benefits", () => {
  it("uses English visual anchors with Burmese supporting copy", () => {
    render(<Benefits />);

    const eyebrow = screen.getByText("Your New Beginning Starts Here");

    expect(eyebrow).toBeTruthy();
    expect(eyebrow.className).toContain("text-[10px]");
    expect(screen.getByRole("heading", { name: "Step Into a Brighter Tomorrow." })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);

    const tagline = screen.getByText("ထိုင်းနိုင်ငံမှာ အသစ်စတင်မယ့် သင့်ရဲ့ဘဝခရီးလမ်းအတွက် အားကိုးရဆုံး အဖော်မွန်အဖြစ် Arun Thai က အမြဲရှိနေပါတယ်။");
    const firstDescription = screen.getByText("ထိုင်းစာကျွမ်းကျင်မှုနဲ့အတူ ပိုမိုကောင်းမွန်တဲ့ လုပ်ငန်းခွင်အခွင့်အလမ်းတွေကို ယုံကြည်မှုရှိရှိ ရယူလိုက်ပါ။");

    expect(tagline.getAttribute("lang")).toBe("my");
    expect(tagline.className).toContain("font-myanmar");
    expect(firstDescription.getAttribute("lang")).toBe("my");
    expect(firstDescription.className).toContain("font-myanmar");
    expect(screen.getByText("Learn together")).toBeTruthy();
  });
});
