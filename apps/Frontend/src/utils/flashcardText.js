export const FLASHCARD_FRONT_LIMIT = 100;
export const FLASHCARD_BACK_LIMIT = 150;
export const FLASHCARD_BACKEND_LIMIT = 280;

// Segment by user-perceived characters. Array.from is an intentional fallback for
// browsers without Intl.Segmenter; it does not split surrogate pairs, but may count
// some combining sequences separately.
export function countGraphemes(value) {
  const text = String(value ?? "");
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)).length;
  }
  return Array.from(text).length;
}

export function getFlashcardTextIssue(value, limit) {
  const text = String(value ?? "");
  const graphemes = countGraphemes(text);
  if (graphemes > limit) return `Keep this field to ${limit} characters or fewer.`;
  if (text.length > FLASHCARD_BACKEND_LIMIT) return `This text exceeds the server storage limit of ${FLASHCARD_BACKEND_LIMIT} characters.`;
  return "";
}

export function isLegacyUnchanged(originalValue, nextValue, limit) {
  return String(originalValue ?? "") === String(nextValue ?? "") && Boolean(getFlashcardTextIssue(originalValue, limit));
}

export function validateFlashcardField({ value, originalValue = "", limit }) {
  if (isLegacyUnchanged(originalValue, value, limit)) return "";
  return getFlashcardTextIssue(value, limit);
}
