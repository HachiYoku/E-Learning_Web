import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTACT_LINKS } from "../config/contactLinks";
import { submitContactLead } from "../services/contactService";
import ContactSection from "./ContactSection";

vi.mock("../services/contactService", () => ({ submitContactLead: vi.fn() }));

let widgetCallbacks;
let turnstile;

function completeForm() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "maya@example.com" } });
}

beforeEach(() => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-public-site-key");
  widgetCallbacks = null;
  turnstile = {
    render: vi.fn((_container, callbacks) => { widgetCallbacks = callbacks; return "widget-1"; }),
    reset: vi.fn(), remove: vi.fn(),
  };
  window.turnstile = turnstile;
  vi.mocked(submitContactLead).mockReset();
});

afterEach(() => {
  cleanup();
  document.getElementById("registration-turnstile-script")?.remove();
  delete window.turnstile;
  vi.unstubAllEnvs();
});

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

  it("requires a contact token and sends it with an optional marketing opt-in", async () => {
    vi.mocked(submitContactLead).mockResolvedValue({ message: "Thanks" });
    render(<ContactSection />);
    completeForm();
    fireEvent.click(screen.getByLabelText(/I’d like to receive course updates/));
    expect(screen.getByRole("button", { name: /send message/i }).disabled).toBe(true);
    expect(widgetCallbacks.action).toBe("contact");

    act(() => widgetCallbacks.callback("fresh-token"));
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(submitContactLead).toHaveBeenCalledWith({
      name: "Maya", email: "maya@example.com", message: "", marketingOptIn: true, website: "", turnstileToken: "fresh-token",
    }));
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");
  });

  it("clears expired and server-rejected tokens while preserving a non-consenting enquiry", async () => {
    vi.mocked(submitContactLead).mockRejectedValueOnce(new Error("Security verification failed or expired. Please try again."));
    render(<ContactSection />);
    completeForm();
    act(() => widgetCallbacks.callback("expired-token"));
    act(() => widgetCallbacks["expired-callback"]());
    expect(screen.getByRole("button", { name: /send message/i }).disabled).toBe(true);
    expect(turnstile.reset).toHaveBeenCalledWith("widget-1");

    act(() => widgetCallbacks.callback("rejected-token"));
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(screen.getByText("Security verification failed or expired. Please try again.")).toBeTruthy());
    expect(screen.getByRole("button", { name: /send message/i }).disabled).toBe(true);
    expect(screen.getByLabelText("Name").value).toBe("Maya");
    expect(screen.getByLabelText("Email address").value).toBe("maya@example.com");
    expect(screen.getByRole("checkbox").checked).toBe(false);
  });

  it("fails closed when the public site key is not configured", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    render(<ContactSection />);
    expect(screen.getByText("Security verification is unavailable. Please try again later.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /send message/i }).disabled).toBe(true);
    expect(turnstile.render).not.toHaveBeenCalled();
  });
});
