import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyFlashcardDeck from "./MyFlashcardDeck";
import MyFlashcards from "./MyFlashcards";
import StudentFlashcardsHub from "./StudentFlashcardsHub";
import * as service from "../services/personalFlashcardService";

vi.mock("../services/personalFlashcardService", () => ({
  fetchPersonalFlashcardDecks: vi.fn(), createPersonalFlashcardDeck: vi.fn(), updatePersonalFlashcardDeck: vi.fn(), deletePersonalFlashcardDeck: vi.fn(),
  fetchPersonalFlashcards: vi.fn(), createPersonalFlashcard: vi.fn(), updatePersonalFlashcard: vi.fn(), deletePersonalFlashcard: vi.fn(),
}));

const deck = { _id: "deck-1", name: "Work Vocabulary", cardCount: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };
const card = { _id: "card-1", prompt: "เงินเดือน", answer: "Salary" };

function renderDeckPage() {
  return render(<MemoryRouter initialEntries={["/app/practice/flashcards/mine/deck-1"]}><Routes><Route path="/app/practice/flashcards/mine/:deckId" element={<MyFlashcardDeck />} /><Route path="/app/practice/flashcards/mine" element={<p>Deck list</p>} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.resetAllMocks();
  service.fetchPersonalFlashcardDecks.mockResolvedValue([deck]);
  service.fetchPersonalFlashcards.mockResolvedValue([card]);
});

describe("student flashcard hub", () => {
  it("links students to public practice and private decks", () => {
    render(<MemoryRouter><StudentFlashcardsHub /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /practice flashcards/i }).getAttribute("href")).toBe("/app/practice/flashcards/public");
    expect(screen.getByRole("link", { name: /my flashcards/i }).getAttribute("href")).toBe("/app/practice/flashcards/mine");
  });
});

describe("My Flashcards deck manager", () => {
  it("loads decks and shows the empty state", async () => {
    service.fetchPersonalFlashcardDecks.mockResolvedValueOnce([deck]);
    const mounted = render(<MemoryRouter><MyFlashcards /></MemoryRouter>);
    expect(await screen.findByText("Work Vocabulary")).toBeTruthy();
    mounted.unmount();
    service.fetchPersonalFlashcardDecks.mockResolvedValueOnce([]);
    render(<MemoryRouter><MyFlashcards /></MemoryRouter>);
    expect(await screen.findByText(/no flashcard decks yet/i)).toBeTruthy();
  });

  it("creates a deck and surfaces duplicate-name errors", async () => {
    const user = userEvent.setup();
    service.fetchPersonalFlashcardDecks.mockResolvedValue([]);
    service.createPersonalFlashcardDeck.mockResolvedValue({ ...deck, cardCount: 0 });
    render(<MemoryRouter><MyFlashcards /></MemoryRouter>);
    await screen.findByText(/no flashcard decks yet/i);
    await user.click(screen.getByRole("button", { name: /create your first deck/i }));
    await user.type(screen.getByLabelText(/deck name/i), "Work Vocabulary");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^create deck$/i }));
    expect(await screen.findByText("Work Vocabulary")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /create deck/i }));
    service.createPersonalFlashcardDeck.mockRejectedValueOnce(new Error("You already have a flashcard deck with that name."));
    await user.type(screen.getByLabelText(/deck name/i), "Work Vocabulary");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^create deck$/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("already have");
  });

  it("renames a deck and requires confirmation before deleting it", async () => {
    const user = userEvent.setup();
    service.updatePersonalFlashcardDeck.mockResolvedValue({ ...deck, name: "Office words" });
    render(<MemoryRouter><MyFlashcards /></MemoryRouter>);
    await screen.findByText("Work Vocabulary");
    await user.click(screen.getByRole("button", { name: /rename work vocabulary/i }));
    const input = screen.getByLabelText(/deck name/i);
    await user.clear(input); await user.type(input, "Office words");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Office words")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /delete office words/i }));
    expect(screen.getByText(/permanently delete this deck/i)).toBeTruthy();
    expect(service.deletePersonalFlashcardDeck).not.toHaveBeenCalled();
    service.deletePersonalFlashcardDeck.mockResolvedValue({ deletedCardCount: 1 });
    await user.click(screen.getByRole("button", { name: /delete deck/i }));
    await waitFor(() => expect(service.deletePersonalFlashcardDeck).toHaveBeenCalledWith("deck-1"));
  });

  it("keeps loaded decks visible when a request fails and offers retry", async () => {
    const user = userEvent.setup();
    service.fetchPersonalFlashcardDecks.mockRejectedValueOnce(new Error("Network unavailable"));
    render(<MemoryRouter><MyFlashcards /></MemoryRouter>);
    expect(await screen.findByText("Network unavailable")).toBeTruthy();
    service.fetchPersonalFlashcardDecks.mockResolvedValueOnce([deck]);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Work Vocabulary")).toBeTruthy();
  });
});

describe("personal deck card manager", () => {
  it("loads, adds, edits, and deletes cards", async () => {
    const user = userEvent.setup();
    renderDeckPage();
    expect(await screen.findByText("เงินเดือน")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /add card/i }));
    await user.type(screen.getByLabelText(/^prompt$/i), "หัวหน้า");
    await user.type(screen.getByLabelText(/^answer$/i), "Manager");
    service.createPersonalFlashcard.mockResolvedValue({ _id: "card-2", prompt: "หัวหน้า", answer: "Manager" });
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^add card$/i }));
    expect(await screen.findByText("หัวหน้า")).toBeTruthy();

    service.updatePersonalFlashcard.mockResolvedValue({ ...card, answer: "Monthly salary" });
    const originalCard = screen.getByText("เงินเดือน").closest("article");
    await user.click(within(originalCard).getByRole("button", { name: /edit/i }));
    const answer = screen.getByLabelText(/^answer$/i);
    await user.clear(answer); await user.type(answer, "Monthly salary");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Monthly salary")).toBeTruthy();

    await user.click(within(originalCard).getByRole("button", { name: /delete/i }));
    expect(screen.getByText(/permanently deleted/i)).toBeTruthy();
    service.deletePersonalFlashcard.mockResolvedValue({});
    await user.click(screen.getByRole("button", { name: /delete card/i }));
    await waitFor(() => expect(service.deletePersonalFlashcard).toHaveBeenCalledWith("deck-1", "card-1"));
  });

  it("shows a failed card request without discarding the loaded deck", async () => {
    const user = userEvent.setup();
    renderDeckPage();
    await screen.findByText("เงินเดือน");
    await user.click(screen.getByRole("button", { name: /add card/i }));
    await user.type(screen.getByLabelText(/^prompt$/i), "Test");
    await user.type(screen.getByLabelText(/^answer$/i), "Test answer");
    service.createPersonalFlashcard.mockRejectedValueOnce(new Error("Could not save card"));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^add card$/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not save card");
    expect(screen.getByText("เงินเดือน")).toBeTruthy();
  });
});
