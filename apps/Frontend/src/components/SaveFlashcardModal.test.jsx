import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SaveFlashcardModal from "./SaveFlashcardModal";
import * as service from "../services/personalFlashcardService";

vi.mock("../services/personalFlashcardService", () => ({
  fetchPersonalFlashcardDecks: vi.fn(),
  createPersonalFlashcardDeck: vi.fn(),
  createPersonalFlashcard: vi.fn(),
}));

const workSet = { _id: "set-work", name: "Work Vocabulary", cardCount: 2 };

function renderModal(props = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = render(<SaveFlashcardModal isOpen onClose={onClose} onSaved={onSaved} {...props} />);
  return { ...view, onClose, onSaved };
}

async function fillCard(user, front = "สวัสดี", back = "Hello") {
  await user.type(screen.getByLabelText(/^front$/i), front);
  await user.type(screen.getByLabelText(/^back$/i), back);
}

async function chooseSet(user, name = "Work Vocabulary") {
  await user.click(screen.getByRole("button", { name: /^select a set$/i }));
  await user.click(screen.getByRole("option", { name }));
}

async function waitForSets(user) {
  await waitFor(() => expect(screen.getByRole("button", { name: /^save$/i }).disabled).toBe(false));
  await user.click(screen.getByRole("button", { name: /^select a set$/i }));
  await screen.findByRole("option", { name: "Work Vocabulary" });
  await user.click(screen.getByRole("button", { name: /^select a set$/i }));
}

beforeEach(() => {
  vi.resetAllMocks();
  service.fetchPersonalFlashcardDecks.mockResolvedValue([workSet]);
});

describe("SaveFlashcardModal", () => {
  it("loads a student's sets and validates the front, back, and destination", async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForSets(user);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByRole("alert").textContent).toContain("front and back");
    expect(service.createPersonalFlashcard).not.toHaveBeenCalled();

    await fillCard(user);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByRole("alert").textContent).toContain("Choose a flashcard set");
  });

  it("saves to a selected existing set without sending ownership fields", async () => {
    const user = userEvent.setup();
    service.createPersonalFlashcard.mockResolvedValue({ _id: "card-1" });
    const { onClose, onSaved } = renderModal();
    await waitForSets(user);
    await fillCard(user);
    await chooseSet(user);
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(service.createPersonalFlashcard).toHaveBeenCalledWith("set-work", { prompt: "สวัสดี", answer: "Hello" }));
    expect(service.createPersonalFlashcard.mock.calls[0][1]).not.toHaveProperty("ownerId");
    expect(service.createPersonalFlashcard.mock.calls[0][1]).not.toHaveProperty("userId");
    expect(onSaved).toHaveBeenCalledWith(workSet);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("creates a new set and then saves the card", async () => {
    const user = userEvent.setup();
    const newSet = { _id: "set-travel", name: "Travel Thai", cardCount: 0 };
    service.createPersonalFlashcardDeck.mockResolvedValue(newSet);
    service.createPersonalFlashcard.mockResolvedValue({ _id: "card-2" });
    const { onSaved } = renderModal();
    await waitForSets(user);
    await fillCard(user, "ไป", "Go");
    await user.click(screen.getByRole("button", { name: /create a new set/i }));
    await user.type(screen.getByLabelText(/set name/i), "Travel Thai");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(service.createPersonalFlashcardDeck).toHaveBeenCalledWith("Travel Thai"));
    expect(service.createPersonalFlashcard).toHaveBeenCalledWith("set-travel", { prompt: "ไป", answer: "Go" });
    expect(onSaved).toHaveBeenCalledWith(newSet);
  });

  it("keeps a successfully created set selected when its card save fails, then retries only the card", async () => {
    const user = userEvent.setup();
    const newSet = { _id: "set-food", name: "Food", cardCount: 0 };
    service.createPersonalFlashcardDeck.mockResolvedValue(newSet);
    service.createPersonalFlashcard.mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce({ _id: "card-3" });
    const { onSaved } = renderModal();
    await waitForSets(user);
    await fillCard(user, "ข้าว", "Rice");
    await user.click(screen.getByRole("button", { name: /create a new set/i }));
    await user.type(screen.getByLabelText(/set name/i), "Food");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Food” was created");
    expect(screen.getByText("Food")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(service.createPersonalFlashcard).toHaveBeenCalledTimes(2));
    expect(service.createPersonalFlashcardDeck).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(newSet);
  });

  it("shows API errors, lets set loading retry, and prevents duplicate pending submissions", async () => {
    const user = userEvent.setup();
    let resolveSave;
    service.fetchPersonalFlashcardDecks.mockRejectedValueOnce(new Error("Sets unavailable")).mockResolvedValueOnce([workSet]);
    service.createPersonalFlashcard.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    renderModal();
    expect(await screen.findByText("Sets unavailable")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitForSets(user);
    await fillCard(user);
    await chooseSet(user);
    const save = screen.getByRole("button", { name: /^save$/i });
    await user.click(save);
    await user.click(screen.getByRole("button", { name: /saving/i }));
    expect(service.createPersonalFlashcard).toHaveBeenCalledTimes(1);
    resolveSave({ _id: "card-4" });
    await waitFor(() => expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy());
  });

  it("resets its fields after a successful save when opened again", async () => {
    const user = userEvent.setup();
    service.createPersonalFlashcard.mockResolvedValue({ _id: "card-5" });
    const { rerender } = renderModal();
    await waitForSets(user);
    await fillCard(user);
    await chooseSet(user);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(service.createPersonalFlashcard).toHaveBeenCalled());
    rerender(<SaveFlashcardModal isOpen={false} onClose={vi.fn()} onSaved={vi.fn()} />);
    rerender(<SaveFlashcardModal isOpen onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitForSets(user);
    expect(screen.getByLabelText(/^front$/i).value).toBe("");
    expect(screen.getByLabelText(/^back$/i).value).toBe("");
  });
});
