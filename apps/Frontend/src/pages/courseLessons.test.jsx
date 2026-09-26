import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourseLessons from "./CourseLessons";
import * as personalService from "../services/personalFlashcardService";

vi.mock("../components/Navbar", () => ({ default: () => <nav>Student navigation</nav> }));
vi.mock("../components/Footer", () => ({ default: () => <footer>Student footer</footer> }));
vi.mock("../components/LoadingSpinner", () => ({ default: () => <p>Loading</p> }));
vi.mock("../services/courseService", () => ({ fetchCourseById: vi.fn() }));
vi.mock("../services/lessonService", () => ({ fetchLessonsByCourse: vi.fn() }));
vi.mock("../services/quizService", () => ({ fetchCourseQuizzes: vi.fn() }));
vi.mock("../services/enrollmentService", () => ({ fetchEnrollmentProgress: vi.fn(), saveLastOpenedLesson: vi.fn(), setLessonCompleted: vi.fn() }));
vi.mock("../services/personalFlashcardService", () => ({ fetchPersonalFlashcardDecks: vi.fn(), createPersonalFlashcardDeck: vi.fn(), createPersonalFlashcard: vi.fn() }));

import { fetchCourseById } from "../services/courseService";
import { fetchLessonsByCourse } from "../services/lessonService";
import { fetchCourseQuizzes } from "../services/quizService";
import { fetchEnrollmentProgress, saveLastOpenedLesson } from "../services/enrollmentService";

beforeEach(() => {
  vi.resetAllMocks();
  fetchCourseById.mockResolvedValue({ id: "course-1", title: "Thai Basics", description: "Learn Thai", features: [] });
  fetchLessonsByCourse.mockResolvedValue([{ id: "lesson-1", title: "Greetings", videoUrl: "https://example.com/greetings", order: 1 }]);
  fetchCourseQuizzes.mockResolvedValue([]);
  fetchEnrollmentProgress.mockResolvedValue({ completedLessonIds: [], completedLessons: 0, totalLessons: 1, percentage: 0 });
  saveLastOpenedLesson.mockResolvedValue({ completedLessonIds: [], completedLessons: 0, totalLessons: 1, percentage: 0 });
  personalService.fetchPersonalFlashcardDecks.mockResolvedValue([{ _id: "set-1", name: "Lesson words" }]);
});

describe("CourseLessons quick save", () => {
  it("opens the composer from an enrolled lesson while retaining the lesson video and quiz action", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: /greetings/i }));
    expect(screen.getByTitle("Greetings")).toBeTruthy();
    expect(screen.getByRole("button", { name: /take lesson quiz/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /add to my flashcards/i }));
    expect(await screen.findByRole("dialog", { name: /add to my flashcards/i })).toBeTruthy();
    expect(screen.getByTitle("Greetings")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /close add to my flashcards/i }));
    expect(screen.queryByRole("dialog", { name: /add to my flashcards/i })).toBeNull();
    expect(screen.getByTitle("Greetings")).toBeTruthy();
  });
});
