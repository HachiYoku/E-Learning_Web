import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = { post: vi.fn() };
vi.mock("../api/client", () => ({ apiClient }));

describe("flashcardReviewService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends only the supported personal review payload", async () => {
    const { ratePersonalFlashcard } = await import("./flashcardReviewService");
    ratePersonalFlashcard("card-1", "hard", { ownerId: "ignored", userId: "ignored" });
    expect(apiClient.post).toHaveBeenCalledWith("/flashcard-reviews/rate", { cardType: "personal", cardId: "card-1", rating: "hard" });
  });
});
