import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = { get: vi.fn(), post: vi.fn() };
vi.mock("../api/client", () => ({ apiClient }));

describe("flashcardReviewService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends only the supported personal review payload", async () => {
    const { ratePersonalFlashcard } = await import("./flashcardReviewService");
    ratePersonalFlashcard("card-1", "hard", { ownerId: "ignored", userId: "ignored" });
    expect(apiClient.post).toHaveBeenCalledWith("/flashcard-reviews/rate", { cardType: "personal", cardId: "card-1", rating: "hard" });
  });

  it("loads the personal review summary and due snapshot through private endpoints", async () => {
    const { fetchDuePersonalFlashcards, fetchPersonalReviewSummary } = await import("./flashcardReviewService");
    fetchPersonalReviewSummary();
    fetchDuePersonalFlashcards();
    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/flashcard-reviews/summary?scope=personal");
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/flashcard-reviews/due?scope=personal&limit=20");
  });
});
