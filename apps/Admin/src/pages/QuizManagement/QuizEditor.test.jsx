import { act, render, screen, waitFor, within } from "@testing-library/react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuizEditor from "./QuizEditor";
const { navigationSpy } = vi.hoisted(() => ({ navigationSpy: vi.fn() }));
vi.mock("react-router-dom", async () => {
  const { createContext, useContext } = await import("react");
  const context = createContext(null);
  return { UNSAFE_NavigationContext: context, useParams: () => ({ id: "quiz-1" }), useNavigate: () => { const { navigator } = useContext(context); return (to) => navigator.push(to); } };
});

vi.mock("../../services/courseService", () => ({ fetchCourses: vi.fn() }));
vi.mock("../../services/lessonService", () => ({ fetchLessonsByCourse: vi.fn() }));
vi.mock("../../services/quizService", () => ({ createQuiz: vi.fn(), createQuizQuestion: vi.fn(), fetchQuiz: vi.fn(), updateQuiz: vi.fn(), updateQuizQuestion: vi.fn() }));
import { fetchCourses } from "../../services/courseService";
import { fetchLessonsByCourse } from "../../services/lessonService";
import { createQuizQuestion, fetchQuiz, updateQuizQuestion, updateQuiz } from "../../services/quizService";

const quiz = { _id: "quiz-1", course: "course-1", lesson: "lesson-1", quizType: "lesson", title: "Quiz", maxAttempts: null, questions: [
  { _id: "question-a", prompt: "First", image: "", audio: "", options: ["A", "B", "", ""], correctAnswer: 0 },
  { _id: "question-b", prompt: "Second", image: "", audio: "", options: ["C", "D", "", ""], correctAnswer: 0 },
] };

function renderEditor() {
  const navigation = { navigator: { push: navigationSpy, replace: navigationSpy, go: navigationSpy } };
  return render(<UNSAFE_NavigationContext.Provider value={navigation}><a href="/courses" onClick={(event) => { event.preventDefault(); navigation.navigator.push("/courses"); }}>Courses navigation</a><QuizEditor /></UNSAFE_NavigationContext.Provider>);
}

function unloadPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("QuizEditor question save state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:local-media");
    URL.revokeObjectURL = vi.fn();
    fetchCourses.mockResolvedValue([{ id: "course-1", title: "Course" }]);
    fetchLessonsByCourse.mockResolvedValue([{ id: "lesson-1", title: "Lesson", order: 1 }]);
    fetchQuiz.mockResolvedValue(quiz);
    updateQuizQuestion.mockImplementation(async (_quizId, _questionId, question) => ({ question: { ...question, imageFile: undefined, audioFile: undefined }, revision: 2 }));
    createQuizQuestion.mockImplementation(async (_quizId, question) => ({ question: { ...question, _id: "question-new", imageFile: undefined, audioFile: undefined }, revision: 2 }));
  });

  it("keeps Add Question local until explicit Save, then clears its unsaved state", async () => {
    const user = userEvent.setup(); renderEditor();
    await screen.findAllByPlaceholderText("What is this?");
    await user.click(screen.getByRole("button", { name: "Add another question" }));
    const newCard = within(screen.getByRole("region", { name: "Question 3" }));
    expect(newCard.getByText("New unsaved question")).toBeTruthy();
    expect(newCard.getByText("Incomplete question")).toBeTruthy();
    expect(createQuizQuestion).not.toHaveBeenCalled();
    expect(unloadPrevented()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(updateQuiz).not.toHaveBeenCalled();
    await user.type(newCard.getByPlaceholderText("What is this?"), "A new question");
    await user.type(newCard.getByPlaceholderText("Answer 1"), "Yes");
    await user.type(newCard.getByPlaceholderText("Answer 2"), "No");
    await user.click(newCard.getByRole("button", { name: "Save question" }));
    await waitFor(() => expect(createQuizQuestion).toHaveBeenCalledWith("quiz-1", expect.objectContaining({ prompt: "A new question" }), {}));
    expect(await within(screen.getByRole("region", { name: "Question 3" })).findByText("Changes saved")).toBeTruthy();
    expect(unloadPrevented()).toBe(false);
  });

  it("retains a failed new Question for Retry and discards only its own local draft", async () => {
    const user = userEvent.setup(); renderEditor();
    const prompts = await screen.findAllByPlaceholderText("What is this?");
    await user.type(prompts[1], " unsaved neighbour");
    await user.click(screen.getByRole("button", { name: "Add another question" }));
    const newCard = within(screen.getByRole("region", { name: "Question 3" }));
    await user.type(newCard.getByPlaceholderText("What is this?"), "Keep me");
    await user.type(newCard.getByPlaceholderText("Answer 1"), "Yes");
    await user.type(newCard.getByPlaceholderText("Answer 2"), "No");
    createQuizQuestion.mockRejectedValueOnce(new Error("Upload failed"));
    await user.click(newCard.getByRole("button", { name: "Save question" }));
    expect(await newCard.findByRole("button", { name: "Retry" })).toBeTruthy();
    expect(newCard.getByPlaceholderText("What is this?").value).toBe("Keep me");
    await user.click(newCard.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Question 3" })).getByText("Changes saved")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "Add another question" }));
    const fourth = within(screen.getByRole("region", { name: "Question 4" }));
    await user.click(fourth.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("region", { name: "Question 4" })).toBeNull();
    expect(prompts[1].value).toBe("Second unsaved neighbour");
    expect(unloadPrevented()).toBe(true);
  });

  it("saves one dirty question without changing another question draft", async () => {
    const user = userEvent.setup(); renderEditor();
    const prompts = await screen.findAllByPlaceholderText("What is this?");
    await user.clear(prompts[0]); await user.type(prompts[0], "First edited");
    expect(screen.getAllByRole("button", { name: "Save question" })[0].disabled).toBe(false);
    await user.click(screen.getAllByRole("button", { name: "Save question" })[0]);
    await waitFor(() => expect(updateQuizQuestion).toHaveBeenCalledWith("quiz-1", "question-a", expect.objectContaining({ prompt: "First edited" }), {}));
    expect(prompts[1].value).toBe("Second");
  });

  it("retains a failed question draft for Retry and Cancel restores the persisted value", async () => {
    const user = userEvent.setup(); updateQuizQuestion.mockRejectedValueOnce(new Error("Upload failed")); renderEditor();
    const prompts = await screen.findAllByPlaceholderText("What is this?");
    await user.clear(prompts[0]); await user.type(prompts[0], "Unsaved");
    await user.click(screen.getAllByRole("button", { name: "Save question" })[0]);
    expect(await screen.findByText("Upload failed")).toBeTruthy();
    expect(prompts[0].value).toBe("Unsaved");
    await user.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    expect(prompts[0].value).toBe("First");
  });

  it("tracks real dirty changes and clears reload protection after reverting text or saving", async () => {
    const user = userEvent.setup(); renderEditor();
    const [prompt] = await screen.findAllByPlaceholderText("What is this?");
    expect(unloadPrevented()).toBe(false);
    await user.type(prompt, " changed");
    expect(unloadPrevented()).toBe(true);
    await user.clear(prompt); await user.type(prompt, "First");
    expect(unloadPrevented()).toBe(false);
    await user.type(prompt, " saved");
    await user.click(within(screen.getByRole("region", { name: "Question 1" })).getByRole("button", { name: "Save question" }));
    await screen.findByText("Changes saved");
    expect(unloadPrevented()).toBe(false);
    await user.type(prompt, " discarded");
    await user.click(within(screen.getByRole("region", { name: "Question 1" })).getByRole("button", { name: "Cancel" }));
    expect(prompt.value).toBe("First saved");
    expect(unloadPrevented()).toBe(false);
  });

  it("isolates saving, saved, error and Retry states across questions and keeps local media", async () => {
    const user = userEvent.setup(); renderEditor();
    const prompts = await screen.findAllByPlaceholderText("What is this?");
    const first = within(screen.getByRole("region", { name: "Question 1" }));
    const second = within(screen.getByRole("region", { name: "Question 2" }));
    await user.type(prompts[0], " saved"); await user.type(prompts[1], " draft");
    let resolveSave;
    updateQuizQuestion.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    await user.click(first.getByRole("button", { name: "Save question" }));
    expect(first.getByRole("button", { name: "Saving…" }).disabled).toBe(true);
    expect(second.getByRole("button", { name: "Save question" }).disabled).toBe(false);
    await act(async () => resolveSave({ question: { ...quiz.questions[0], prompt: "First saved" } }));
    expect(first.getByText("Changes saved")).toBeTruthy();
    const file = new File(["audio"], "listen.mp3", { type: "audio/mpeg" });
    await user.upload(second.getByLabelText(/Prompt audio/), file);
    updateQuizQuestion.mockRejectedValueOnce(new Error("Unable to save this question. Please retry."));
    await user.click(second.getByRole("button", { name: "Save question" }));
    expect(await second.findByRole("button", { name: "Retry" })).toBeTruthy();
    expect(prompts[0].value).toBe("First saved");
    expect(prompts[1].value).toBe("Second draft");
    expect(screen.getByRole("region", { name: "Question 2" }).querySelector("audio").getAttribute("src")).toBe("blob:local-media");
    await user.click(second.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(second.getByText("Changes saved")).toBeTruthy());
    expect(updateQuizQuestion.mock.calls.at(-1)[2].audioFile).toBe(file);
    expect(unloadPrevented()).toBe(false);
  });

  it("Cancel discards only that question's local media and retains the other draft", async () => {
    const user = userEvent.setup(); renderEditor();
    const prompts = await screen.findAllByPlaceholderText("What is this?");
    await user.type(prompts[1], " keep");
    const first = within(screen.getByRole("region", { name: "Question 1" }));
    await user.upload(first.getByLabelText(/Prompt audio/), new File(["audio"], "listen.mp3", { type: "audio/mpeg" }));
    await user.click(first.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("region", { name: "Question 1" }).querySelector("audio")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-media");
    expect(prompts[1].value).toBe("Second keep");
    expect(unloadPrevented()).toBe(true);
  });

  it("marks the complete card incomplete, provides guidance and clears the status when valid", async () => {
    const user = userEvent.setup(); renderEditor();
    const [prompt] = await screen.findAllByPlaceholderText("What is this?");
    const card = screen.getByRole("region", { name: "Question 1" });
    await user.clear(prompt);
    expect(within(card).getByText("Incomplete question")).toBeTruthy();
    expect(within(card).getByText("Add question content")).toBeTruthy();
    expect(card.className).toContain("border-red-300");
    await user.type(prompt, "Valid content");
    expect(within(card).queryByText("Incomplete question")).toBeNull();
  });

  it("keeps history/scoring confirmations separate, keyboard accessible, and never submits the whole form", async () => {
    const user = userEvent.setup(); const nativeConfirm = vi.spyOn(window, "confirm"); renderEditor();
    const [prompt] = await screen.findAllByPlaceholderText("What is this?");
    await user.type(prompt, " change");
    updateQuizQuestion.mockRejectedValueOnce(Object.assign(new Error("History"), { code: "question_history_requires_confirmation" }));
    await user.click(within(screen.getByRole("region", { name: "Question 1" })).getByRole("button", { name: "Save question" }));
    let dialog = await screen.findByRole("dialog", { name: "Students have already taken this quiz" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(updateQuizQuestion).toHaveBeenCalledTimes(1);
    updateQuizQuestion.mockRejectedValueOnce(Object.assign(new Error("History"), { code: "question_history_requires_confirmation" }));
    await user.click(within(screen.getByRole("region", { name: "Question 1" })).getByRole("button", { name: "Save question" }));
    dialog = await screen.findByRole("dialog", { name: "Students have already taken this quiz" });
    updateQuizQuestion.mockRejectedValueOnce(Object.assign(new Error("Scoring"), { code: "active_sessions_require_confirmation" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue & Save" }));
    dialog = await screen.findByRole("dialog", { name: "Active students will need to restart" });
    await user.click(within(dialog).getByRole("button", { name: "Update & Restart Sessions" }));
    await screen.findByText("Changes saved");
    expect(updateQuizQuestion.mock.calls.at(-1)[3]).toEqual({ confirmHistoryChange: true, confirmScoringChange: true });
    expect(updateQuiz).not.toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it("protects normal navigation only while a local question draft is dirty", async () => {
    const user = userEvent.setup(); renderEditor();
    const [prompt] = await screen.findAllByPlaceholderText("What is this?");
    await user.type(prompt, " unsaved");
    await user.click(screen.getByRole("link", { name: "Courses navigation" }));
    const dialog = await screen.findByRole("dialog", { name: "Leave without saving?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(prompt.value).toBe("First unsaved");
    await user.click(within(screen.getByRole("region", { name: "Question 1" })).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("link", { name: "Courses navigation" }));
    expect(navigationSpy).toHaveBeenCalledWith("/courses");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
