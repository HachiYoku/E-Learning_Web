import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourseLessons from "./CourseLessons";
import * as personalService from "../services/personalFlashcardService";

vi.mock("../components/Navbar", () => ({ default: () => <nav>Student navigation</nav> }));
vi.mock("../components/Footer", () => ({ default: () => <footer>Student footer</footer> }));
vi.mock("../components/LoadingSpinner", () => ({ default: () => <p>Loading</p> }));
vi.mock("../services/courseService", () => ({ fetchCourseById: vi.fn() }));
vi.mock("../services/lessonService", () => ({ fetchLessonsByCourse: vi.fn() }));
vi.mock("../services/quizService", () => ({ fetchCourseQuizzes: vi.fn(), fetchQuizzesForLesson: vi.fn() }));
vi.mock("../services/enrollmentService", () => ({ fetchEnrollmentProgress: vi.fn(), saveLastOpenedLesson: vi.fn(), setLessonCompleted: vi.fn() }));
vi.mock("../services/personalFlashcardService", () => ({ fetchPersonalFlashcardDecks: vi.fn(), createPersonalFlashcardDeck: vi.fn(), createPersonalFlashcard: vi.fn(), deletePersonalFlashcard: vi.fn() }));

import { fetchCourseById } from "../services/courseService";
import { fetchLessonsByCourse } from "../services/lessonService";
import { fetchCourseQuizzes, fetchQuizzesForLesson } from "../services/quizService";
import { fetchEnrollmentProgress, saveLastOpenedLesson, setLessonCompleted } from "../services/enrollmentService";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchCourseById.mockResolvedValue({ id: "course-1", title: "Thai Basics", description: "Learn Thai", features: [] });
  fetchLessonsByCourse.mockResolvedValue([{ id: "lesson-1", title: "Greetings", videoUrl: "https://example.com/greetings", order: 1 }]);
  fetchCourseQuizzes.mockResolvedValue([]);
  fetchQuizzesForLesson.mockResolvedValue([{ _id: "lesson-quiz-1" }]);
  fetchEnrollmentProgress.mockResolvedValue({ completedLessonIds: [], completedLessons: 0, totalLessons: 1, percentage: 0 });
  saveLastOpenedLesson.mockResolvedValue({ completedLessonIds: [], completedLessons: 0, totalLessons: 1, percentage: 0 });
  setLessonCompleted.mockResolvedValue({ completedLessonIds: ['lesson-1'], completedLessons: 1, totalLessons: 1, percentage: 100 });
  personalService.fetchPersonalFlashcardDecks.mockResolvedValue([{ _id: "set-1", name: "Lesson words" }]);
  personalService.deletePersonalFlashcard.mockResolvedValue({ message: 'Flashcard deleted successfully' });
});

describe("CourseLessons quick save", () => {
  it('keeps the course and lessons available when optional Course Final state cannot load', async () => {
    fetchCourseQuizzes.mockRejectedValueOnce(new Error('Quiz is unavailable.'));
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    expect(await screen.findByText('Your lessons')).toBeTruthy();
    expect(screen.getByText('Greetings')).toBeTruthy();
  });

  it('renders a locked Course Final with published lesson quiz progress and no start action', async () => {
    fetchCourseQuizzes.mockResolvedValueOnce([{ id: 'final-1', _id: 'final-1', title: 'Course final', locked: true, requiredLessonQuizCount: 3, completedLessonQuizCount: 2, maxAttempts: 3, attemptsUsed: 0, questions: [] }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    expect((await screen.findAllByText('Course final')).length).toBeGreaterThan(0);
    expect(screen.getByText('2 of 3 lesson quizzes completed')).toBeTruthy();
    expect(screen.getByText('Complete all required lesson quizzes to unlock the Course Final.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Locked' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Locked' }).querySelector('svg')).toBeTruthy();
  });

  it('renders an unlocked zero-requirement Course Final as ready to start', async () => {
    fetchCourseQuizzes.mockResolvedValueOnce([{ id: 'final-1', _id: 'final-1', title: 'Course final', locked: false, requiredLessonQuizCount: 0, completedLessonQuizCount: 0, maxAttempts: 3, attemptsUsed: 0, timesTaken: 0, goalPercent: 80, goalReached: false, questions: [{ _id: 'q1' }] }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    expect(await screen.findByText('Ready to start')).toBeTruthy();
    expect(screen.getByText(/Goal: 80%/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start final' })).toBeTruthy();
  });

  it('retains the existing Goal reached Course Final treatment', async () => {
    fetchCourseQuizzes.mockResolvedValueOnce([{ id: 'final-1', _id: 'final-1', title: 'Course final', locked: false, maxAttempts: 3, attemptsUsed: 2, timesTaken: 2, goalPercent: 80, goalReached: true, questions: [{ _id: 'q1' }] }]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Goal reached')).toBeTruthy();
    expect(screen.getByText(/Goal: 80%/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start final' })).toBeTruthy();
  });

  it('does not offer a Quiz action for a lesson without a published Quiz', async () => {
    fetchQuizzesForLesson.mockResolvedValueOnce([]);
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);
    await screen.findByText('Your lessons');
    expect(screen.queryByRole('button', { name: 'Quiz', exact: true })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: /greetings/i }));
    expect(screen.queryByRole('button', { name: 'Take lesson quiz' })).toBeNull();
  });

  it('opens only the requested authorized lesson and consumes the resume URL intent', async () => {
    fetchLessonsByCourse.mockResolvedValue([
      { id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1 },
      { id: 'lesson-2', title: 'Introductions', videoUrl: 'https://example.com/introductions', order: 2 },
    ]);
    fetchEnrollmentProgress.mockResolvedValue({ completedLessonIds: [], completedLessons: 0, totalLessons: 2, percentage: 0 });
    render(<MemoryRouter initialEntries={["/app/learn/course-1?lesson=lesson-2"]}><Routes><Route path="/app/learn/:courseId" element={<><CourseLessons /><LocationProbe /></>} /></Routes></MemoryRouter>);

    expect(await screen.findByTitle('Introductions')).toBeTruthy();
    expect(screen.queryByTitle('Greetings')).toBeNull();
    await waitFor(() => expect(saveLastOpenedLesson).toHaveBeenCalledWith('course-1', 'lesson-2'));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1'));
  });

  it.each(['lesson-deleted', 'not-an-object-id'])('safely ignores an unavailable or malformed resume lesson ID: %s', async (lessonId) => {
    render(<MemoryRouter initialEntries={[`/app/learn/course-1?lesson=${lessonId}`]}><Routes><Route path="/app/learn/:courseId" element={<><CourseLessons /><LocationProbe /></>} /></Routes></MemoryRouter>);

    expect(await screen.findByText('Your lessons')).toBeTruthy();
    expect(screen.queryByTitle('Greetings')).toBeNull();
    expect(saveLastOpenedLesson).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1'));
  });

  it('does not open a valid-looking lesson ID that is absent from this course’s authorized lesson response', async () => {
    const foreignLessonId = '507f1f77bcf86cd799439011';
    render(<MemoryRouter initialEntries={[`/app/learn/course-1?lesson=${foreignLessonId}`]}><Routes><Route path="/app/learn/:courseId" element={<><CourseLessons /><LocationProbe /></>} /></Routes></MemoryRouter>);

    expect(await screen.findByText('Your lessons')).toBeTruthy();
    expect(screen.queryByTitle('Greetings')).toBeNull();
    expect(saveLastOpenedLesson).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1'));
  });

  it('does not reopen a resumed lesson after the student closes it', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/app/learn/course-1?lesson=lesson-1"]}><Routes><Route path="/app/learn/:courseId" element={<><CourseLessons /><LocationProbe /></>} /></Routes></MemoryRouter>);

    expect(await screen.findByTitle('Greetings')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /close video/i }));
    await waitFor(() => expect(screen.queryByTitle('Greetings')).toBeNull());
    expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1');
    expect(saveLastOpenedLesson).toHaveBeenCalledTimes(1);
  });

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

  it('marks an incomplete lesson complete from the modal and updates the existing progress UI', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Mark Complete' }));

    await waitFor(() => expect(setLessonCompleted).toHaveBeenCalledWith('course-1', 'lesson-1', true));
    expect(screen.queryByRole('button', { name: 'Mark Complete' })).toBeNull();
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.getByText('1 complete')).toBeTruthy();
  });

  it('offers and opens the first incomplete lesson after completing the current lesson', async () => {
    const user = userEvent.setup();
    fetchLessonsByCourse.mockResolvedValue([
      { id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1 },
      { id: 'lesson-2', title: 'Directions', videoUrl: 'https://example.com/directions', order: 9 },
      { id: 'lesson-3', title: 'Shopping', videoUrl: 'https://example.com/shopping', order: 21 },
    ]);
    setLessonCompleted.mockResolvedValue({ completedLessonIds: ['lesson-1'], completedLessons: 1, totalLessons: 3, percentage: 33 });
    saveLastOpenedLesson.mockImplementation((_, lessonId) => Promise.resolve(lessonId === 'lesson-2'
      ? { completedLessonIds: ['lesson-1'], completedLessons: 1, totalLessons: 3, percentage: 33 }
      : { completedLessonIds: [], completedLessons: 0, totalLessons: 3, percentage: 0 }));
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Mark Complete' }));
    const continueButton = await screen.findByRole('button', { name: /continue to next lesson/i });
    expect(screen.getByText('Lesson 9 · Directions')).toBeTruthy();
    await user.click(continueButton);

    expect(await screen.findByTitle('Directions')).toBeTruthy();
    await waitFor(() => expect(saveLastOpenedLesson).toHaveBeenLastCalledWith('course-1', 'lesson-2'));
  });

  it('offers the remaining earlier incomplete lesson when no later incomplete lesson exists', async () => {
    const user = userEvent.setup();
    fetchLessonsByCourse.mockResolvedValue([
      { id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1 },
      { id: 'lesson-2', title: 'Directions', videoUrl: 'https://example.com/directions', order: 9 },
      { id: 'lesson-3', title: 'Shopping', videoUrl: 'https://example.com/shopping', order: 21 },
    ]);
    fetchEnrollmentProgress.mockResolvedValue({ completedLessonIds: ['lesson-2', 'lesson-3'], completedLessons: 2, totalLessons: 3, percentage: 67 });
    saveLastOpenedLesson.mockResolvedValue({ completedLessonIds: ['lesson-2', 'lesson-3'], completedLessons: 2, totalLessons: 3, percentage: 67 });
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /shopping/i }));
    expect(await screen.findByRole('button', { name: 'Continue Course' })).toBeTruthy();
    expect(screen.getByText('Lesson 1 · Greetings')).toBeTruthy();
  });

  it('shows a completed state in the modal when the lesson was already completed', async () => {
    const user = userEvent.setup();
    fetchEnrollmentProgress.mockResolvedValue({ completedLessonIds: ['lesson-1'], completedLessons: 1, totalLessons: 1, percentage: 100 });
    saveLastOpenedLesson.mockResolvedValue({ completedLessonIds: ['lesson-1'], completedLessons: 1, totalLessons: 1, percentage: 100 });
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    expect(screen.queryByRole('button', { name: 'Mark Complete' })).toBeNull();
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Completed').find((element) => element.tagName === 'SPAN').className).toContain('bg-[#E9F4EA]');
    expect(screen.getByText('All lessons completed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Course' })).toBeTruthy();
    expect(setLessonCompleted).not.toHaveBeenCalled();
  });

  it('prevents duplicate completion requests while the modal action is pending', async () => {
    const user = userEvent.setup();
    let resolveCompletion;
    setLessonCompleted.mockImplementation(() => new Promise((resolve) => { resolveCompletion = resolve; }));
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    await user.click(screen.getByRole('button', { name: 'Mark Complete' }));
    const savingButtons = screen.getAllByRole('button', { name: 'Saving...' });
    expect(savingButtons).toHaveLength(2);
    expect(savingButtons.every((button) => button.disabled)).toBe(true);
    expect(screen.queryByLabelText('Lesson progression')).toBeNull();
    await user.click(savingButtons[0]);
    expect(setLessonCompleted).toHaveBeenCalledTimes(1);

    resolveCompletion({ completedLessonIds: ['lesson-1'], completedLessons: 1, totalLessons: 1, percentage: 100 });
    await waitFor(() => expect(screen.getAllByText('Completed').length).toBeGreaterThan(0));
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
    expect(modal.className).toContain('lesson-modal');
    expect(modal.className).toContain('h-[calc(100dvh-6rem)]');
    expect(modal.className).toContain('sm:h-[calc(100dvh-3rem)]');
    expect(footer.className).toContain('shrink-0');
    expect(screen.getByRole('button', { name: /take lesson quiz/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeTruthy();
    const actionGrid = screen.getByRole('button', { name: /add to my flashcards/i }).parentElement;
    expect(actionGrid.className).toContain('grid-cols-2');
    expect(screen.getByRole('button', { name: /take lesson quiz/i }).className).toContain('w-full');
    expect(screen.getByRole('button', { name: 'Mark Complete' }).className).toContain('w-full');
    expect(vocabularyScrollArea.className).toContain('min-h-0');
    expect(vocabularyScrollArea.className).toContain('flex-1');
    expect(vocabularyScrollArea.className).toContain('overflow-y-auto');
  });

  it('expands only the existing lesson footer when Up Next appears', async () => {
    const user = userEvent.setup();
    fetchLessonsByCourse.mockResolvedValue([
      { id: 'lesson-1', title: 'Greetings', videoUrl: 'https://example.com/greetings', order: 1, keyVocabulary: [{ _id: 'vocabulary-1', thai: 'สวัสดี', translation: 'Hello' }] },
      { id: 'lesson-2', title: 'Next lesson', videoUrl: 'https://example.com/next', order: 2, keyVocabulary: [] },
    ]);
    fetchEnrollmentProgress.mockResolvedValue({ completedLessonIds: ['lesson-1'], completedLessons: 1, totalLessons: 2, percentage: 50 });
    saveLastOpenedLesson.mockResolvedValue({ completedLessonIds: ['lesson-1'], completedLessons: 1, totalLessons: 2, percentage: 50 });
    render(<MemoryRouter initialEntries={["/app/learn/course-1"]}><Routes><Route path="/app/learn/:courseId" element={<CourseLessons />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /greetings/i }));
    expect(screen.getByRole('button', { name: /continue to next lesson/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /add to my flashcards/i }).closest('.shrink-0').className).toContain('min-h-[20rem]');
    expect(screen.getByLabelText('Lesson progression').className).toContain('p-3');
    expect(screen.getByText('Hello').closest('.grid').closest('.lesson-key-vocabulary').className).toContain('flex-1');
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
    const vocabularyDialog = await screen.findByRole('dialog', { name: /save to my flashcards/i });
    expect(within(vocabularyDialog).getByText('สวัสดี')).toBeTruthy();
    expect(within(vocabularyDialog).getByText('Hello')).toBeTruthy();
    expect(screen.queryByLabelText(/^front$/i)).toBeNull();
    expect(screen.queryByLabelText(/^back$/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: /close add to my flashcards/i }));
    await user.click(screen.getByRole('button', { name: 'Save vocabulary ขอบคุณ to My Flashcards' }));
    expect(within(screen.getByRole('dialog')).getByText('ขอบคุณ')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText('Thank you')).toBeTruthy();
    expect(screen.queryByLabelText(/^front$/i)).toBeNull();

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
