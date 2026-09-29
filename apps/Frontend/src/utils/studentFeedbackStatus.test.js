import { describe, expect, it } from "vitest";
import { feedbackStatus, feedbackStatusLabel } from "./studentFeedbackStatus";

describe("student feedback status", () => {
  it.each([
    [{ publicationConsent: { status: "private" }, publication: { status: "private" } }, "Private"],
    [{ publicationConsent: { status: "permitted" }, publication: { status: "awaiting_review" } }, "Awaiting website review"],
    [{ publicationConsent: { status: "permitted" }, publication: { status: "published" } }, "Published"],
    [{ publicationConsent: { status: "permitted" }, publication: { status: "not_selected" } }, "Not selected for website"],
    [{ publicationConsent: { status: "withdrawn" }, publication: { status: "published" } }, "Sharing withdrawn"],
  ])("presents internal state as %s", (feedback, label) => {
    expect(feedbackStatusLabel(feedback)).toBe(label);
  });

  it("prioritizes a student withdrawal over a stale publication value", () => {
    expect(feedbackStatus({ publicationConsent: { status: "withdrawn" }, publication: { status: "published" } })).toBe("withdrawn");
  });
});
