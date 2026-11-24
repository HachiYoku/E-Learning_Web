import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FlashcardPracticeSession from "./FlashcardPracticeSession";

const cards = [{ _id: "card-1", prompt: "สวัสดี", answer: "Hello" }];

describe("FlashcardPracticeSession", () => {
  it("uses compact accessible horizontal rating choices without changing callbacks", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<FlashcardPracticeSession cards={cards} onRate={onRate} onExit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Show flashcard back" }));
    const again = screen.getByRole("button", { name: "Again — Didn't remember" });
    expect(again.parentElement.className).toContain("grid-cols-3");
    await user.click(again);
    expect(onRate).toHaveBeenCalledWith(cards[0], "again");
  });

  it("keeps long content available in a scrollable region and offers a keyboard flip button", async () => {
    const user = userEvent.setup();
    render(<FlashcardPracticeSession cards={[{ ...cards[0], prompt: "x".repeat(200) }]} onExit={vi.fn()} />);
    expect(screen.getByText("x".repeat(200)).parentElement.parentElement.className).toContain("overflow-y-auto");
    const flip = screen.getByRole("button", { name: "Show flashcard back" });
    flip.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Show flashcard front" })).toBeTruthy();
  });

  it("flips reliably from direct front and back text taps without duplicate flips", () => {
    render(<FlashcardPracticeSession cards={cards} onExit={vi.fn()} />);
    const front = screen.getByText("สวัสดี");
    fireEvent.pointerDown(front, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(front, { pointerId: 1, clientX: 20, clientY: 20 });
    expect(screen.getByRole("button", { name: "Show flashcard front" })).toBeTruthy();

    const back = screen.getByText("Hello");
    fireEvent.pointerDown(back, { pointerId: 2, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(back, { pointerId: 2, clientX: 20, clientY: 20 });
    expect(screen.getByRole("button", { name: "Show flashcard back" })).toBeTruthy();
  });

  it("does not flip after scroll, drag, or pointer cancellation but accepts the next normal tap", () => {
    render(<FlashcardPracticeSession cards={[{ ...cards[0], prompt: "x".repeat(200) }]} onExit={vi.fn()} />);
    const text = screen.getByText("x".repeat(200));
    fireEvent.pointerDown(text, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(text, { pointerId: 1, clientX: 20, clientY: 45 });
    fireEvent.scroll(text.parentElement.parentElement);
    fireEvent.pointerUp(text, { pointerId: 1, clientX: 20, clientY: 45 });
    expect(screen.getByRole("button", { name: "Show flashcard back" })).toBeTruthy();

    fireEvent.pointerDown(text, { pointerId: 2, clientX: 20, clientY: 20 });
    fireEvent.pointerCancel(text, { pointerId: 2 });
    fireEvent.pointerUp(text, { pointerId: 2, clientX: 20, clientY: 20 });
    expect(screen.getByRole("button", { name: "Show flashcard back" })).toBeTruthy();

    fireEvent.pointerDown(text, { pointerId: 3, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(text, { pointerId: 3, clientX: 20, clientY: 20 });
    expect(screen.getByRole("button", { name: "Show flashcard front" })).toBeTruthy();
  });

  it("centers short text-only content while leaving measured overflow scrollable from its beginning", async () => {
    const short = render(<FlashcardPracticeSession cards={cards} onExit={vi.fn()} />);
    expect(screen.getByText("สวัสดี").parentElement.className).toContain("justify-center");
    short.unmount();
    render(<FlashcardPracticeSession cards={[{ ...cards[0], prompt: "x".repeat(200) }]} onExit={vi.fn()} />);
    const text = screen.getByText("x".repeat(200));
    const scrollRegion = text.parentElement.parentElement;
    Object.defineProperty(scrollRegion, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(scrollRegion, "scrollHeight", { configurable: true, value: 240 });
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(text.parentElement.className).not.toContain("justify-center"));
  });
});
