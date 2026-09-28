import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONTACT_LINKS } from "../config/contactLinks";
import OurServices from "./OurServices";

describe("OurServices", () => {
  it("uses the approved English service names with Myanmar explanations", () => {
    render(<OurServices />);

    expect(screen.getByText("Learn your way")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Our Thai Learning Services." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Live Zoom Classes" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Self-Paced Video Classes" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Job-Ready Thai Class" })).toBeTruthy();
    expect(screen.getByText("Real-Time Practice & Guidance")).toBeTruthy();
    expect(screen.getByText("Live class")).toBeTruthy();
    expect(screen.getByText("Self-paced")).toBeTruthy();
    expect(screen.getByText("Career Thai")).toBeTruthy();

    const sectionDescription = screen.getByText("သင့်ရဲ့ ရည်မှန်းချက်၊ အချိန်နဲ့ သင်ယူမှုပုံစံနဲ့ အကိုက်ညီဆုံး ထိုင်းစာသင်တန်းကို ရွေးချယ်လိုက်ပါ။");
    const serviceDescriptions = document.querySelectorAll("article p[lang='my']");

    expect(sectionDescription.getAttribute("lang")).toBe("my");
    expect(sectionDescription.className).toContain("font-myanmar");
    expect(serviceDescriptions).toHaveLength(3);
    serviceDescriptions.forEach((description) => expect(description.className).toContain("font-myanmar"));
    expect(screen.queryByText("What you’ll get")).toBeNull();
  });

  it("opens one accessible contact chooser without placeholder links", () => {
    render(<OurServices />);

    expect(screen.getAllByRole("button", { name: /contact us/i })).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: /contact us/i })[0]);

    const dialog = screen.getByRole("dialog", { name: /let's talk/i });
    expect(dialog).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    [
      ["Facebook Messenger", CONTACT_LINKS.messenger],
      ["LINE", CONTACT_LINKS.line],
    ].forEach(([label, href]) => {
      const link = screen.queryByRole("link", { name: label });
      if (href) {
        expect(link.getAttribute("href")).toBe(href);
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      } else {
        expect(link).toBeNull();
        expect(screen.getByRole("button", { name: new RegExp(`${label} is not available yet`, "i") }).disabled).toBe(true);
      }
    });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /let's talk/i })).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});
