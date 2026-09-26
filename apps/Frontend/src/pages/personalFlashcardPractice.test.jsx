import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalFlashcardPractice from "./PersonalFlashcardPractice";
import * as personalService from "../services/personalFlashcardService";

vi.mock("../services/personalFlashcardService", () => ({
  fetchPersonalFlashcardDecks: vi.fn(), fetchPersonalFlashcards: vi.fn(),
}));
vi.mock("../services/flashcardService", () => ({ fetchFlashcards: vi.fn() }));

const deck = { _id: "deck-1", name: "Work Vocabulary", cardCount: 2 };
const cards = [{ _id: "one", prompt: "เงินเดือน", answer: "Salary" }, { _id: "two", prompt: "หัวหน้า", answer: "Manager" }];

function renderPractice() {
  return render(<MemoryRouter initialEntries={["/app/practice/flashcards/mine/deck-1/practice"]}><Routes><Route path="/app/practice/flashcards/mine/:deckId/practice" element={<PersonalFlashcardPractice />} /><Route path="/app/practice/flashcards/mine/:deckId" element={<p>Deck manager</p>} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.resetAllMocks();
  personalService.fetchPersonalFlashcardDecks.mockResolvedValue([deck]);
  personalService.fetchPersonalFlashcards.mockResolvedValue(cards);
});

describe("personal flashcard practice", () => {
  it("loads only private deck cards and flips, rates, advances, completes, and resets locally", async () => {
    const user = userEvent.setup();
    renderPractice();
    expect(await screen.findByText("Work Vocabulary")).toBeTruthy();
    expect(personalService.fetchPersonalFlashcards).toHaveBeenCalledWith("deck-1");
    expect(screen.getByText("Card 1 of 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /show flashcard back/i }));
    expect(screen.getByText("Salary")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /again/i }));
    expect(screen.getByText("Card 2 of 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /show flashcard back/i }));
    await user.click(screen.getByRole("button", { name: /easy/i }));
    expect(await screen.findByText("Practice complete")).toBeTruthy();
    expect(screen.getByText("2 cards reviewed")).toBeTruthy();
    expect(within(screen.getByText("Again").parentElement).getByText("1")).toBeTruthy();
    expect(within(screen.getByText("Easy").parentElement).getByText("1")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /practice again/i }));
    expect(screen.getByText("Card 1 of 2")).toBeTruthy();
  });

  it("handles empty, missing, and failed private deck loads with a retry path", async () => {
    personalService.fetchPersonalFlashcards.mockResolvedValueOnce([]);
    const empty = renderPractice();
    expect(await screen.findByText(/add some flashcards before/i)).toBeTruthy();
    empty.unmount();

    personalService.fetchPersonalFlashcardDecks.mockResolvedValueOnce([]);
    renderPractice();
    expect(await screen.findByText("Flashcard deck not found.")).toBeTruthy();
  });

  it("retries a private API failure and returns to the deck manager", async () => {
    const user = userEvent.setup();
    personalService.fetchPersonalFlashcards.mockRejectedValueOnce(new Error("Private cards unavailable"));
    renderPractice();
    expect(await screen.findByText("Private cards unavailable")).toBeTruthy();
    personalService.fetchPersonalFlashcards.mockResolvedValueOnce(cards);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Card 1 of 2")).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to deck/i }).getAttribute("href")).toBe("/app/practice/flashcards/mine/deck-1");
  });
});
