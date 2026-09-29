import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONTACT_LINKS } from "../config/contactLinks";
import ContactSection from "./ContactSection";

vi.mock("../services/contactService", () => ({ submitContactLead: vi.fn() }));

describe("ContactSection", () => {
  it("uses Myanmar explanatory copy and the shared contact-link configuration", () => {
    render(<ContactSection />);

    expect(screen.getByRole("heading", { name: "Let’s Talk About Your Thai Journey." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Have a Question?" })).toBeTruthy();
    const description = screen.getByText("သင်တန်းအကြောင်း သိချင်တာပဲဖြစ်ဖြစ်၊ ဘယ်သင်တန်းက သင့်အတွက် အသင့်တော်ဆုံးလဲ မေးချင်တာပဲဖြစ်ဖြစ် Arun Thai ကို အချိန်မရွေး ဆက်သွယ်မေးမြန်းနိုင်ပါတယ်။");
    expect(description.getAttribute("lang")).toBe("my");
    expect(description.className).toContain("font-myanmar");
    expect(screen.getByRole("checkbox").checked).toBe(false);

    const messenger = screen.queryByRole("link", { name: "Facebook Messenger" });
    if (CONTACT_LINKS.messenger) expect(messenger.getAttribute("href")).toBe(CONTACT_LINKS.messenger);
    else expect(screen.getByRole("button", { name: /facebook messenger is not available yet/i }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /line is not available yet/i }).disabled).toBe(true);
    const tiktok = screen.queryByRole("link", { name: "TikTok" });
    if (CONTACT_LINKS.tiktok) expect(tiktok.getAttribute("href")).toBe(CONTACT_LINKS.tiktok);
    else expect(screen.getByRole("button", { name: /tiktok is not available yet/i }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /instagram is not available yet/i }).disabled).toBe(true);
  });

  it("submits the existing payload with an opt-in boolean", async () => {
    const { submitContactLead } = await import("../services/contactService");
    submitContactLead.mockResolvedValue({ message: "Thanks" });
    render(<ContactSection />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "maya@example.com" } });
    fireEvent.click(screen.getByLabelText(/I’d like to receive course updates/));
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(submitContactLead).toHaveBeenCalledWith(expect.objectContaining({ name: "Maya", email: "maya@example.com", marketingOptIn: true }));
  });
});
