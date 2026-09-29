import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
vi.mock("../api/client", () => ({ apiClient }));

describe("personalFlashcardService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses only deck/card fields and never sends owner or user identifiers", async () => {
    const service = await import("./personalFlashcardService");
    service.createPersonalFlashcardDeck(" Work ");
    service.updatePersonalFlashcardDeck("deck-1", " Work words ");
    service.createPersonalFlashcard("deck-1", { prompt: " Front ", answer: " Back ", ownerId: "attacker", userId: "attacker" });
    service.updatePersonalFlashcard("deck-1", "card-1", { prompt: " New front ", answer: " New back ", ownerId: "attacker" });
    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/my-flashcards/decks", { name: "Work" });
    expect(apiClient.put).toHaveBeenNthCalledWith(1, "/my-flashcards/decks/deck-1", { name: "Work words" });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/my-flashcards/decks/deck-1/cards", { prompt: "Front", answer: "Back" });
    expect(apiClient.put).toHaveBeenNthCalledWith(2, "/my-flashcards/decks/deck-1/cards/card-1", { prompt: "New front", answer: "New back" });
  });
});
