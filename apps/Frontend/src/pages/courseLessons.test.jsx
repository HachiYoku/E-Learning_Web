import { act, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("../services/personalFlashcardService", () => ({ fetchPersonalFlashcardDecks: vi.fn(), createPersonalFlashcardDeck: vi.fn(), createPersonalFlashcard: vi.fn(), deletePersonalFlashcard: vi.fn() }));

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
  personalService.deletePersonalFlashcard.mockResolvedValue({ message: 'Flashcard deleted successfully' });
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

  it('displays vocabulary for the active lesson only and keeps the manual composer action available', async () => {
    const user = userEvent.setup();
    fetchLessonsByCourse.mockResolvedValue([
      {
        id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1,
        keyVocabulary: [{ _id: 'vocabulary-1', thai: 'สวัสดี', transliteration: 'sa-wat-dee', translation: 'Hello' }],
      },
      {
        id: 'lesson-2', title: 'Thanks', videoUrl: 'https://example.com/thanks', order: 2,
        keyVocabulary: [{ _id: 'vocabulary-2', thai: 'ขอบคุณ', transliteration: '', translation: 'Thank you' }],
      },
    ]);
    fetchEnrollmentProgress.mockResolvedValue({ completedLessonIds: [], completedLessons: 0, totalLessons: 2, percentage: 0 });
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    expect(screen.getByRole('heading', { name: 'Key Vocabulary' })).toBeTruthy();
    expect(screen.getByText('สวัสดี')).toBeTruthy();
    expect(screen.getByText('sa-wat-dee')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add to my flashcards/i })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /close video/i }));
    await user.click(screen.getByRole('button', { name: /thanks/i }));
    expect(screen.getByText('ขอบคุณ')).toBeTruthy();
    expect(screen.getByText('Thank you')).toBeTruthy();
    expect(screen.queryByText('sa-wat-dee')).toBeNull();
  });

  it('keeps lesson actions in a shrink-0 footer while vocabulary owns the modal scroll area', async () => {
    const user = userEvent.setup();
    fetchLessonsByCourse.mockResolvedValue([{
      id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1,
      keyVocabulary: [{ _id: 'vocabulary-1', thai: 'สวัสดี', translation: 'Hello' }],
    }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));

    const video = screen.getByTitle('Greetings');
    const modal = video.closest('.relative');
    const footer = screen.getByRole('button', { name: /add to my flashcards/i }).closest('.shrink-0');
    const grid = screen.getByText('Hello').closest('.grid');
    const vocabularyScrollArea = grid.parentElement;

    expect(modal.className).toContain('h-[calc(100dvh-3rem)]');
    expect(modal.className).toContain('flex-col');
    expect(modal.className).toContain('overflow-hidden');
    expect(footer.className).toContain('shrink-0');
    expect(screen.getByRole('button', { name: /take lesson quiz/i })).toBeTruthy();
    expect(vocabularyScrollArea.className).toContain('min-h-0');
    expect(vocabularyScrollArea.className).toContain('flex-1');
    expect(vocabularyScrollArea.className).toContain('overflow-y-auto');
  });

  it('opens one vocabulary composer with the selected Thai and translation, then opens the manual composer blank', async () => {
    const user = userEvent.setup();
    fetchLessonsByCourse.mockResolvedValue([{
      id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1,
      keyVocabulary: [
        { _id: 'vocabulary-1', thai: 'สวัสดี', transliteration: 'sa-wat-dee', translation: 'Hello' },
        { _id: 'vocabulary-2', thai: 'ขอบคุณ', transliteration: 'khop-khun', translation: 'Thank you' },
      ],
    }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Save vocabulary สวัสดี to My Flashcards' }));
    expect(await screen.findByRole('dialog', { name: /add to my flashcards/i })).toBeTruthy();
    expect(screen.getByLabelText(/^front$/i).value).toBe('สวัสดี');
    expect(screen.getByLabelText(/^back$/i).value).toBe('Hello');
    expect(screen.queryByText('sa-wat-dee', { selector: 'textarea' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /close add to my flashcards/i }));
    await user.click(screen.getByRole('button', { name: 'Save vocabulary ขอบคุณ to My Flashcards' }));
    expect(screen.getByLabelText(/^front$/i).value).toBe('ขอบคุณ');
    expect(screen.getByLabelText(/^back$/i).value).toBe('Thank you');

    await user.click(screen.getByRole('button', { name: /close add to my flashcards/i }));
    await user.click(screen.getByRole('button', { name: /add to my flashcards/i }));
    expect(screen.getByLabelText(/^front$/i).value).toBe('');
    expect(screen.getByLabelText(/^back$/i).value).toBe('');
    expect(screen.getByTitle('Greetings')).toBeTruthy();
  });

  it('saves vocabulary through the private set API and keeps the lesson video open', async () => {
    const user = userEvent.setup();
    personalService.createPersonalFlashcard.mockResolvedValue({ _id: 'card-1' });
    fetchLessonsByCourse.mockResolvedValue([{
      id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1,
      keyVocabulary: [{ _id: 'vocabulary-1', thai: 'สวัสดี', transliteration: 'sa-wat-dee', translation: 'Hello' }],
    }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Save vocabulary สวัสดี to My Flashcards' }));
    await user.click(await screen.findByRole('button', { name: /^select a set$/i }));
    await user.click(screen.getByRole('option', { name: 'Lesson words' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(personalService.createPersonalFlashcard).toHaveBeenCalledWith('set-1', { prompt: 'สวัสดี', answer: 'Hello' }));
    expect(personalService.createPersonalFlashcard.mock.calls[0][1]).not.toHaveProperty('ownerId');
    expect(personalService.createPersonalFlashcard.mock.calls[0][1]).not.toHaveProperty('userId');
    expect(screen.getByTitle('Greetings')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Saved to Lesson words');
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('undoes only the exact newly saved vocabulary card and restores that card Save action', async () => {
    const user = userEvent.setup();
    personalService.createPersonalFlashcard.mockResolvedValue({ _id: 'card-to-undo' });
    fetchLessonsByCourse.mockResolvedValue([{
      id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1,
      keyVocabulary: [{ _id: 'vocabulary-1', thai: 'สวัสดี', translation: 'Hello' }],
    }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Save vocabulary สวัสดี to My Flashcards' }));
    await user.click(await screen.findByRole('button', { name: /^select a set$/i }));
    await user.click(screen.getByRole('option', { name: 'Lesson words' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findByRole('button', { name: 'Undo' });

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(personalService.deletePersonalFlashcard).toHaveBeenCalledWith('set-1', 'card-to-undo'));
    expect(personalService.deletePersonalFlashcard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save vocabulary สวัสดี to My Flashcards' })).toBeTruthy();
  });

  it('keeps a saved card in place and prevents duplicate Undo requests when deletion fails', async () => {
    const user = userEvent.setup();
    let rejectDelete;
    personalService.createPersonalFlashcard.mockResolvedValue({ _id: 'card-delete-failure' });
    personalService.deletePersonalFlashcard.mockImplementation(() => new Promise((resolve, reject) => { rejectDelete = reject; }));
    fetchLessonsByCourse.mockResolvedValue([{
      id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1,
      keyVocabulary: [{ _id: 'vocabulary-1', thai: 'สวัสดี', translation: 'Hello' }],
    }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Save vocabulary สวัสดี to My Flashcards' }));
    await user.click(await screen.findByRole('button', { name: /^select a set$/i }));
    await user.click(screen.getByRole('option', { name: 'Lesson words' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Undoing...' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Undoing...' }));
    expect(personalService.deletePersonalFlashcard).toHaveBeenCalledTimes(1);
    rejectDelete(new Error('Network unavailable'));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not undo');
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('does not leak a saved state from one lesson into another lesson', async () => {
    const user = userEvent.setup();
    personalService.createPersonalFlashcard.mockResolvedValue({ _id: 'card-lesson-one' });
    fetchLessonsByCourse.mockResolvedValue([
      { id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1, keyVocabulary: [{ _id: 'vocabulary-1', thai: 'สวัสดี', translation: 'Hello' }] },
      { id: 'lesson-2', title: 'Thanks', videoUrl: 'https://example.com/thanks', order: 2, keyVocabulary: [{ _id: 'vocabulary-2', thai: 'ขอบคุณ', translation: 'Thank you' }] },
    ]);
    fetchEnrollmentProgress.mockResolvedValue({ completedLessonIds: [], completedLessons: 0, totalLessons: 2, percentage: 0 });
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Save vocabulary สวัสดี to My Flashcards' }));
    await user.click(await screen.findByRole('button', { name: /^select a set$/i }));
    await user.click(screen.getByRole('option', { name: 'Lesson words' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findByText('Saved');

    await user.click(screen.getByRole('button', { name: /close video/i }));
    await user.click(screen.getByRole('button', { name: /thanks/i }));
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save vocabulary ขอบคุณ to My Flashcards' })).toBeTruthy();
  });

  it('keeps Undo available for five seconds before leaving the vocabulary card saved', async () => {
    const user = userEvent.setup();
    personalService.createPersonalFlashcard.mockResolvedValue({ _id: 'card-expiring-undo' });
    fetchLessonsByCourse.mockResolvedValue([{
      id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1,
      keyVocabulary: [{ _id: 'vocabulary-1', thai: 'สวัสดี', translation: 'Hello' }],
    }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Save vocabulary สวัสดี to My Flashcards' }));
    await user.click(await screen.findByRole('button', { name: /^select a set$/i }));
    await user.click(screen.getByRole('option', { name: 'Lesson words' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findByRole('button', { name: 'Undo' });

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5100)); });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByText('Saved')).toBeTruthy();
  }, 10000);
});
