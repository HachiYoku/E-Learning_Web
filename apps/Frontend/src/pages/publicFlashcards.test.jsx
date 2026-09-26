import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Flashcards from "./Flashcards";
import { fetchFlashcards } from "../services/flashcardService";

vi.mock("../services/flashcardService", () => ({ fetchFlashcards: vi.fn() }));
vi.mock("../components/Navbar", () => ({ default: () => <nav>Public navigation</nav> }));
vi.mock("../components/Footer", () => ({ default: () => <footer>Public footer</footer> }));

describe("public Flashcards", () => {
  beforeEach(() => vi.resetAllMocks());

  it("continues to show published category practice to visitors", async () => {
    const user = userEvent.setup();
    fetchFlashcards.mockResolvedValue([{ _id: "public-card", prompt: "Hello", answer: "Sawasdee", category: { _id: "thai", name: "Thai basics" } }]);
    render(<MemoryRouter><Flashcards /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: /thai basics/i }));
    expect(screen.getByText("Card 1 of 1")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /show flashcard back/i }));
    await user.click(screen.getByRole("button", { name: /easy/i }));
    expect(await screen.findByText("Practice complete")).toBeTruthy();
    expect(screen.getByText("Public navigation")).toBeTruthy();
  });
});
