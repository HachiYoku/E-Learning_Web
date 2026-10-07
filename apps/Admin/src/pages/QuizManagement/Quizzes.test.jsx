import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Quizzes from "./Quizzes";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../../services/quizService", () => ({ fetchQuizzes: vi.fn(), archiveQuiz: vi.fn(), restoreQuiz: vi.fn(), deleteQuiz: vi.fn(), changeQuizAvailability: vi.fn() }));
import { changeQuizAvailability, fetchQuizzes, restoreQuiz } from "../../services/quizService";

describe("Quiz Management archived recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchQuizzes.mockResolvedValue([
      { id: "active-1", title: "Current quiz", status: "published", quizType: "lesson", questions: [], course: { _id: "course-1", title: "Thai" }, attemptCount: 0 },
      { id: "archived-1", title: "Archived quiz", status: "archived", quizType: "course", questions: [], course: { _id: "course-1", title: "Thai" }, attemptCount: 2 },
    ]);
    restoreQuiz.mockResolvedValue({ quiz: { _id: "archived-1", status: "disabled" } });
  });

  it("finds an archived Quiz and restores it as disabled without publishing", async () => {
    const user = userEvent.setup();
    render(<Quizzes />);
    expect(await screen.findByText("Current quiz")).toBeTruthy();
    expect(screen.queryByText("Archived quiz")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Quiz status" }));
    await user.click(screen.getByRole("option", { name: "Archived quizzes" }));
    expect(screen.getByText("Archived quiz")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restore quiz as disabled" }));
    await waitFor(() => expect(restoreQuiz).toHaveBeenCalledWith("archived-1"));
    expect(screen.queryByText("Archived quiz")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Quiz status" }));
    await user.click(screen.getByRole("option", { name: "Current quizzes" }));
    expect(screen.getByText("Archived quiz")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Restore quiz as disabled" })).toBeNull();
    expect(screen.getByRole("button", { name: "Publish Quiz" })).toBeTruthy();
  });

  it("confirms Disable Quiz, then shows Disabled and Publish Quiz", async () => {
    const user = userEvent.setup();
    fetchQuizzes.mockResolvedValueOnce([{ id: "active-1", title: "Current quiz", status: "published", quizType: "lesson", questions: [], course: { _id: "course-1", title: "Thai" }, attemptCount: 1 }]);
    changeQuizAvailability.mockResolvedValueOnce({ quiz: { status: "disabled", revision: 2 } });
    render(<Quizzes />);
    await screen.findByText("Current quiz");
    await user.click(screen.getByRole("button", { name: "Disable Quiz" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/history and results will be preserved/i)).toBeTruthy();
    expect(changeQuizAvailability).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(changeQuizAvailability).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Disable Quiz" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disable Quiz" }));
    await waitFor(() => expect(changeQuizAvailability).toHaveBeenCalledWith("active-1", "disabled"));
    expect(screen.getByText("Disabled")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish Quiz" })).toBeTruthy();
  });

  it("publishes a Disabled Quiz without removing its history", async () => {
    const user = userEvent.setup();
    fetchQuizzes.mockResolvedValueOnce([{ id: "disabled-1", title: "Disabled quiz", status: "disabled", quizType: "course", questions: [], course: { _id: "course-1", title: "Thai" }, attemptCount: 2 }]);
    changeQuizAvailability.mockResolvedValueOnce({ quiz: { status: "published", revision: 3 } });
    render(<Quizzes />);
    await screen.findByText("Disabled quiz");
    await user.click(screen.getByRole("button", { name: "Publish Quiz" }));
    await waitFor(() => expect(changeQuizAvailability).toHaveBeenCalledWith("disabled-1", "published"));
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.getByText(/cannot be permanently deleted/i)).toBeTruthy();
  });
});
