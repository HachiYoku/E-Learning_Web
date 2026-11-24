import { describe, expect, it } from "vitest";
import { countGraphemes, FLASHCARD_BACK_LIMIT, FLASHCARD_FRONT_LIMIT, validateFlashcardField } from "./flashcardText";

describe("flashcard text limits", () => {
  it("counts Thai combining marks and emoji sequences as graphemes where Intl.Segmenter is available", () => {
    expect(countGraphemes("กำ")).toBe(1);
    expect(countGraphemes("👩🏽‍💻")).toBe(1);
  });

  it("enforces the approved front and back boundaries without truncating text", () => {
    expect(validateFlashcardField({ value: "a".repeat(FLASHCARD_FRONT_LIMIT), limit: FLASHCARD_FRONT_LIMIT })).toBe("");
    expect(validateFlashcardField({ value: "a".repeat(FLASHCARD_FRONT_LIMIT + 1), limit: FLASHCARD_FRONT_LIMIT })).toContain("100");
    expect(validateFlashcardField({ value: "a".repeat(FLASHCARD_BACK_LIMIT + 1), limit: FLASHCARD_BACK_LIMIT })).toContain("150");
  });

  it("permits an unchanged legacy value but rejects an edited over-limit value", () => {
    const legacy = "a".repeat(101);
    expect(validateFlashcardField({ value: legacy, originalValue: legacy, limit: FLASHCARD_FRONT_LIMIT })).toBe("");
    expect(validateFlashcardField({ value: `${legacy}!`, originalValue: legacy, limit: FLASHCARD_FRONT_LIMIT })).toContain("100");
  });
});
