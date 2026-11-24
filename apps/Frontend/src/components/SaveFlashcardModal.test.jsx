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

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function renderModal(props = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = render(<SaveFlashcardModal isOpen onClose={onClose} onSaved={onSaved} userId="student-1" {...props} />);
  return { ...view, onClose, onSaved };
}

async function waitForSets() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Choose a set" }).disabled).toBe(false));
}

async function fillCard(user, front = "สวัสดี", back = "Hello") {
  await user.type(screen.getByLabelText(/front/i), front);
  await user.type(screen.getByLabelText(/back/i), back);
}

async function chooseWorkSet(user) {
  await user.click(screen.getByRole("button", { name: "Choose a set" }));
  await user.click(screen.getByRole("option", { name: "Work Vocabulary" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("localStorage", createStorage());
  service.fetchPersonalFlashcardDecks.mockResolvedValue([workSet]);
});

describe("SaveFlashcardModal", () => {
  it("starts manual cards blank with helpful editable fields and validates required values", async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForSets();

    expect(screen.getByPlaceholderText("Enter a word or phrase")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter a meaning or translation")).toBeTruthy();
    await chooseWorkSet(user);
    await user.click(screen.getByRole("button", { name: "Save Flashcard" }));
    expect(screen.getByRole("alert").textContent).toContain("word or phrase");
  });

  it("keeps vocabulary values editable and preserves them while changing set modes", async () => {
    const user = userEvent.setup();
    renderModal({ initialFront: "สวัสดี", initialBack: "Hello" });
    await waitForSets();
    expect(screen.getByLabelText(/front/i).value).toBe("สวัสดี");
    await user.clear(screen.getByLabelText(/front/i));
    await user.type(screen.getByLabelText(/front/i), "Edited greeting");
    await user.click(screen.getByRole("radio", { name: "Create new set" }));
    expect(screen.getByLabelText(/front/i).value).toBe("Edited greeting");
    expect(screen.getByLabelText(/back/i).value).toBe("Hello");
    await user.click(screen.getByRole("radio", { name: "Existing set" }));
    expect(screen.getByLabelText(/front/i).value).toBe("Edited greeting");
  });

  it("defaults to Create new set only when the owned set list is empty", async () => {
    service.fetchPersonalFlashcardDecks.mockResolvedValueOnce([]);
    renderModal();
    await waitFor(() => expect(screen.getByRole("radio", { name: "Create new set" }).getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByLabelText("New set name")).toBeTruthy();
  });

  it("restores a valid last-used set only for the current student", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("arunthai:flashcards:last-set:student-1", "set-work");
    window.localStorage.setItem("arunthai:flashcards:last-set:another-student", "foreign-set");
    renderModal();
    await waitForSets();
    await user.click(screen.getByRole("button", { name: "Choose a set" }));
    expect(screen.getByRole("option", { name: "Work Vocabulary" }).getAttribute("aria-selected")).toBe("true");
  });

  it("does not select a remembered set that is no longer owned", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("arunthai:flashcards:last-set:student-1", "deleted-set");
    renderModal();
    await waitForSets();
    await user.click(screen.getByRole("button", { name: "Choose a set" }));
    expect(screen.getByRole("option", { name: "Work Vocabulary" }).getAttribute("aria-selected")).toBe("false");
  });

  it("saves an existing set, remembers it only after success, and closes", async () => {
    const user = userEvent.setup();
    service.createPersonalFlashcard.mockResolvedValue({ _id: "card-1" });
    const { onClose, onSaved } = renderModal();
    await waitForSets();
    await fillCard(user);
    await chooseWorkSet(user);
    await user.click(screen.getByRole("button", { name: "Save Flashcard" }));

    await waitFor(() => expect(service.createPersonalFlashcard).toHaveBeenCalledWith("set-work", { prompt: "สวัสดี", answer: "Hello" }));
    expect(onSaved).toHaveBeenCalledWith(workSet);
    expect(onClose).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("arunthai:flashcards:last-set:student-1")).toBe("set-work");
  });

  it("creates a set and card in one action", async () => {
    const user = userEvent.setup();
    const newSet = { _id: "set-travel", name: "Travel Thai" };
    service.createPersonalFlashcardDeck.mockResolvedValue(newSet);
    service.createPersonalFlashcard.mockResolvedValue({ _id: "card-2" });
    renderModal();
    await waitForSets();
    await fillCard(user, "ไป", "Go");
    await user.click(screen.getByRole("radio", { name: "Create new set" }));
    await user.type(screen.getByLabelText("New set name"), "Travel Thai");
    await user.click(screen.getByRole("button", { name: "Create Set & Save" }));

    await waitFor(() => expect(service.createPersonalFlashcardDeck).toHaveBeenCalledWith("Travel Thai"));
    expect(service.createPersonalFlashcard).toHaveBeenCalledWith("set-travel", { prompt: "ไป", answer: "Go" });
  });

  it("retries only the card after a new-set card-save failure", async () => {
    const user = userEvent.setup();
    const newSet = { _id: "set-food", name: "Food" };
    service.createPersonalFlashcardDeck.mockResolvedValue(newSet);
    service.createPersonalFlashcard.mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce({ _id: "card-3" });
    renderModal();
    await waitForSets();
    await fillCard(user, "ข้าว", "Rice");
    await user.click(screen.getByRole("radio", { name: "Create new set" }));
    await user.type(screen.getByLabelText("New set name"), "Food");
    await user.click(screen.getByRole("button", { name: "Create Set & Save" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Food” was created");
    await user.click(screen.getByRole("button", { name: "Choose a set" }));
    expect(screen.getByRole("option", { name: "Food" }).getAttribute("aria-selected")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Save Flashcard" }));
    await waitFor(() => expect(service.createPersonalFlashcard).toHaveBeenCalledTimes(2));
    expect(service.createPersonalFlashcardDeck).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate requests while pending and supports retrying a set-list error", async () => {
    const user = userEvent.setup();
    let resolveSave;
    service.fetchPersonalFlashcardDecks.mockRejectedValueOnce(new Error("Sets unavailable")).mockResolvedValueOnce([workSet]);
    service.createPersonalFlashcard.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    renderModal();
    expect(await screen.findByText("Sets unavailable")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitForSets();
    await fillCard(user);
    await chooseWorkSet(user);
    await user.click(screen.getByRole("button", { name: "Save Flashcard" }));
    expect(screen.getByRole("button", { name: "Saving flashcard..." }).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Saving flashcard..." }));
    expect(service.createPersonalFlashcard).toHaveBeenCalledTimes(1);
    resolveSave({ _id: "card-4" });
  });

  it("supports Escape dismissal and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const { onClose, unmount } = renderModal();
    await waitForSets();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("uses a scrollable body and separate footer so set selection cannot cover actions", async () => {
    renderModal();
    await waitForSets();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-h-[calc(100dvh-1.5rem)]");
    expect(dialog.querySelector("form > div").className).toContain("overflow-y-auto");
    expect(screen.getByRole("button", { name: "Save Flashcard" }).closest("footer").className).toContain("shrink-0");
  });

  it("uses an inline accessible set list with keyboard selection and Escape before the modal closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await waitForSets();
    const trigger = screen.getByRole("button", { name: "Choose a set" });
    await user.click(trigger);
    expect(screen.getByRole("listbox").className).toContain("relative");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(trigger.textContent).toContain("Work Vocabulary");
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows Unicode-aware counters and retains over-limit pasted text for correction", async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForSets();
    const front = screen.getByLabelText(/front/i);
    await user.type(front, "a".repeat(101));
    await user.type(screen.getByLabelText(/back/i), "Valid answer");
    expect(front.value).toHaveLength(101);
    expect(screen.getByText(/101 \/ 100/)).toBeTruthy();
    await chooseWorkSet(user);
    await user.click(screen.getByRole("button", { name: "Save Flashcard" }));
    expect(screen.getByRole("alert").textContent).toContain("100 characters");
  });
});
