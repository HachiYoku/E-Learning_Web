import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalFlashcardReview from "./PersonalFlashcardReview";
import MyFlashcards from "./MyFlashcards";
import * as reviewService from "../services/flashcardReviewService";
import * as personalService from "../services/personalFlashcardService";

vi.mock("../services/flashcardReviewService", () => ({
  fetchDuePersonalFlashcards: vi.fn(),
  fetchPersonalReviewSummary: vi.fn(),
  ratePersonalFlashcard: vi.fn(),
}));
vi.mock("../services/personalFlashcardService", () => ({
  fetchPersonalFlashcardDecks: vi.fn(),
  createPersonalFlashcardDeck: vi.fn(),
  updatePersonalFlashcardDeck: vi.fn(),
  deletePersonalFlashcardDeck: vi.fn(),
}));

const dueCard = { _id: "due-card-1", prompt: "สวัสดี", answer: "Hello" };

function renderPage() {
  return render(<MemoryRouter initialEntries={["/app/practice/flashcards/review"]}><Routes><Route path="/app/practice/flashcards/review" element={<PersonalFlashcardReview />} /><Route path="/app/practice/flashcards/mine" element={<p>My Flashcards page</p>} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.resetAllMocks();
  reviewService.fetchDuePersonalFlashcards.mockResolvedValue({ reviews: [{ card: dueCard, review: {} }], limit: 20 });
  reviewService.fetchPersonalReviewSummary.mockResolvedValue({ dueCount: 0 });
  reviewService.ratePersonalFlashcard.mockResolvedValue({});
  personalService.fetchPersonalFlashcardDecks.mockResolvedValue([]);
});

describe("personal due review", () => {
  it("loads one server-provided due snapshot, persists a rating before advancing, and shows review results", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("สวัสดี")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /show flashcard back/i }));
    await user.click(screen.getByRole("button", { name: /^easy/i }));
    await waitFor(() => expect(reviewService.ratePersonalFlashcard).toHaveBeenCalledWith("due-card-1", "easy"));
    expect(await screen.findByText(/review complete/i)).toBeTruthy();
    expect(reviewService.fetchDuePersonalFlashcards).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/your score/i)).toBeNull();
  });

  it("shows a caught-up state when the due snapshot is empty", async () => {
    reviewService.fetchDuePersonalFlashcards.mockResolvedValueOnce({ reviews: [], limit: 20 });
    renderPage();
    expect(await screen.findByText(/you're all caught up/i)).toBeTruthy();
    expect(screen.queryByText(/card 1 of/i)).toBeNull();
  });

  it("allows a stale card to be skipped without logging a rating", async () => {
    const user = userEvent.setup();
    reviewService.ratePersonalFlashcard.mockRejectedValueOnce({ status: 404 });
    renderPage();
    await screen.findByText("สวัสดี");
    await user.click(screen.getByRole("button", { name: /show flashcard back/i }));
    await user.click(screen.getByRole("button", { name: /^again/i }));
    expect(await screen.findByText(/no longer available/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(await screen.findByText(/review complete/i)).toBeTruthy();
    expect(screen.getByText(/0 cards reviewed/i)).toBeTruthy();
    expect(reviewService.ratePersonalFlashcard).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed rating on the current flashcard for an intentional retry", async () => {
    const user = userEvent.setup();
    reviewService.ratePersonalFlashcard.mockRejectedValueOnce(new Error("Network unavailable"));
    renderPage();
    await screen.findByText("สวัสดี");
    await user.click(screen.getByRole("button", { name: /show flashcard back/i }));
    await user.click(screen.getByRole("button", { name: /^hard/i }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("สวัสดี")).toBeTruthy();
  });

  it("accepts only one rapid rating while the persistence request is pending", async () => {
    const user = userEvent.setup();
    let resolveRating;
    reviewService.ratePersonalFlashcard.mockImplementationOnce(() => new Promise((resolve) => { resolveRating = resolve; }));
    renderPage();
    await screen.findByText("สวัสดี");
    await user.click(screen.getByRole("button", { name: /show flashcard back/i }));
    await user.click(screen.getByRole("button", { name: /^again/i }));
    await user.click(screen.getByRole("button", { name: /^again/i }));
    expect(reviewService.ratePersonalFlashcard).toHaveBeenCalledTimes(1);
    resolveRating({});
    expect(await screen.findByText(/review complete/i)).toBeTruthy();
  });

  it("returns to My Flashcards from review completion", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("สวัสดี");
    await user.click(screen.getByRole("button", { name: /show flashcard back/i }));
    await user.click(screen.getByRole("button", { name: /^easy/i }));
    await screen.findByText(/review complete/i);
    await user.click(screen.getByRole("button", { name: /back to my flashcards/i }));
    expect(await screen.findByText("My Flashcards page")).toBeTruthy();
  });

  it("refreshes the review summary when returning to My Flashcards", async () => {
    const user = userEvent.setup();
    reviewService.fetchPersonalReviewSummary.mockResolvedValueOnce({ dueCount: 1 }).mockResolvedValueOnce({ dueCount: 0 });
    reviewService.fetchDuePersonalFlashcards.mockResolvedValueOnce({ reviews: [], limit: 20 });
    render(<MemoryRouter initialEntries={["/app/practice/flashcards/mine"]}><Routes><Route path="/app/practice/flashcards/mine" element={<MyFlashcards />} /><Route path="/app/practice/flashcards/review" element={<PersonalFlashcardReview />} /></Routes></MemoryRouter>);
    await screen.findByRole("link", { name: /start review/i });
    await user.click(screen.getByRole("link", { name: /start review/i }));
    expect(await screen.findByText(/you're all caught up/i)).toBeTruthy();
    await user.click(screen.getAllByRole("link", { name: /back to my flashcards/i }).at(-1));
    expect(await screen.findByText(/no flashcards are ready for review/i)).toBeTruthy();
    expect(reviewService.fetchPersonalReviewSummary).toHaveBeenCalledTimes(2);
  });
});
