import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Quiz from './Quiz'

const { authState } = vi.hoisted(() => ({ authState: { user: { id: 'student-a' } } }))
const storage = new Map()

vi.mock('../components/Navbar', () => ({ default: () => <nav>Student navigation</nav> }))
vi.mock('../components/Footer', () => ({ default: () => <footer>Student footer</footer> }))
vi.mock('../components/LoadingSpinner', () => ({ default: () => <p>Loading</p> }))
vi.mock('../services/quizService', () => ({ fetchQuizzesForLesson: vi.fn(), fetchCourseQuizzes: vi.fn(), fetchQuizHistory: vi.fn(), startQuizSession: vi.fn(), submitQuiz: vi.fn(), fetchQuizAttemptRequests: vi.fn(), createQuizAttemptRequest: vi.fn(), cancelQuizAttemptRequest: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../services/enrollmentService', () => ({ checkEnrollment: vi.fn() }))
import { checkEnrollment } from '../services/enrollmentService'

import { fetchCourseQuizzes, fetchQuizHistory, fetchQuizzesForLesson, startQuizSession, submitQuiz, fetchQuizAttemptRequests, createQuizAttemptRequest, cancelQuizAttemptRequest } from '../services/quizService'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderLessonQuiz() {
  return render(<MemoryRouter initialEntries={['/app/learn/course-1/quiz/lesson-1']}><Routes><Route path="/app/learn/:courseId/quiz/:lessonId" element={<Quiz />} /></Routes></MemoryRouter>)
}

const lessonQuiz = {
  _id: 'quiz-1',
  title: 'Greetings quiz',
  maxAttempts: null,
  attemptsUsed: 0,
  questions: [{ _id: 'question-1', prompt: 'Choose hello', image: 'https://example.com/question.jpg', options: ['Hello', 'Goodbye'] }],
}

async function submitSingleQuestion(user) {
  await user.click(await screen.findByRole('button', { name: /hello/i }))
  await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
  await user.click(screen.getByRole('button', { name: 'Submit quiz' }))
}

describe('Quiz result navigation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    storage.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    })
    authState.user = { id: 'student-a' }
    fetchQuizzesForLesson.mockResolvedValue([lessonQuiz])
    fetchQuizHistory.mockResolvedValue({ attempts: [], attemptsUsed: 0, maxAttempts: null, bestScore: 0 })
    fetchQuizAttemptRequests.mockResolvedValue({ requests: [] })
    startQuizSession.mockResolvedValue({ sessionId: 'session-1', revision: 1 })
    checkEnrollment.mockResolvedValue({ enrolled: true })
    submitQuiz.mockResolvedValue({ score: 1, total: 1, showCorrectAnswers: false, attemptsUsed: 1, maxAttempts: null })
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue() })
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  })

  it('restores an unfinished draft only for the authenticated student after a refresh', async () => {
    localStorage.setItem('quiz-draft:student-a:course-1:lesson-1:lesson', JSON.stringify({ quizId: 'quiz-1', questionIndex: 0, answers: [0] }))
    const { unmount } = renderLessonQuiz()

    expect((await screen.findByRole('button', { name: /hello/i })).className).toContain('bg-[#FFF4D8]')
    unmount()
    renderLessonQuiz()

    expect((await screen.findByRole('button', { name: /hello/i })).className).toContain('bg-[#FFF4D8]')
  })

  it('does not restore another student’s draft for the same quiz identifiers', async () => {
    localStorage.setItem('quiz-draft:student-a:course-1:lesson-1:lesson', JSON.stringify({ quizId: 'quiz-1', questionIndex: 0, answers: [0] }))
    authState.user = { id: 'student-b' }
    renderLessonQuiz()

    expect((await screen.findByRole('button', { name: /hello/i })).className).toContain('border-[#2D2E30]/10')
    expect(localStorage.getItem('quiz-draft:student-a:course-1:lesson-1:lesson')).not.toBeNull()
  })

  it('does not adopt the obsolete unscoped draft key', async () => {
    localStorage.setItem('quiz-draft:course-1:lesson-1:lesson', JSON.stringify({ quizId: 'quiz-1', questionIndex: 0, answers: [0] }))
    renderLessonQuiz()

    expect((await screen.findByRole('button', { name: /hello/i })).className).toContain('border-[#2D2E30]/10')
  })

  it('clears the current student draft after submission and starts Try Again with blank answers', async () => {
    const user = userEvent.setup()
    renderLessonQuiz()
    await user.click(await screen.findByRole('button', { name: /hello/i }))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    await user.click(screen.getByRole('button', { name: 'Submit quiz' }))

    await screen.findByRole('button', { name: 'Try again' })
    expect(localStorage.getItem('quiz-draft:student-a:course-1:lesson-1:lesson')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await screen.findByRole('button', { name: /hello/i })
    await waitFor(() => expect(JSON.parse(localStorage.getItem('quiz-draft:student-a:course-1:lesson-1:lesson'))).toMatchObject({ quizId: 'quiz-1', questionIndex: 0, answers: [null] }))
  })

  it('uses the server-provided answer review immediately after submission', async () => {
    const user = userEvent.setup()
    submitQuiz.mockResolvedValueOnce({ score: 1, total: 1, attemptsUsed: 1, maxAttempts: null, review: [{ selectedAnswer: 0, correctAnswer: 0, isCorrect: true }] })
    renderLessonQuiz()

    await user.click(await screen.findByRole('button', { name: /goodbye/i }))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    await user.click(screen.getByRole('button', { name: 'Submit quiz' }))
    expect((await screen.findByText(/your answer:/i)).parentElement.textContent).toContain('Hello')
    expect(screen.getByText('Right')).toBeTruthy()
    expect(screen.getByText(/correct answer:/i)).toBeTruthy()
    expect(screen.getByText('Your score')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.getByText('1 / 1 correct')).toBeTruthy()
    expect(document.querySelector('.rounded-full.border-8')).toBeNull()
    expect(screen.getByText('Perfect! Excellent work.')).toBeTruthy()
    expect(screen.queryByText("You're making progress. Try again!")).toBeNull()
    expect(screen.queryByText("You've used all available attempts.")).toBeNull()
  })

  it('encourages another attempt when a Lesson Quiz has unlimited retakes', async () => {
    const user = userEvent.setup()
    submitQuiz.mockResolvedValueOnce({ score: 0, total: 1, attemptsUsed: 1, maxAttempts: null, review: [{ selectedAnswer: 1, isCorrect: false }] })
    renderLessonQuiz()
    await submitSingleQuestion(user)
    expect(await screen.findByText('Keep Practicing')).toBeTruthy()
    expect(screen.getByText("You're making progress. Try again!")).toBeTruthy()
    expect(screen.queryByText("You've used all available attempts.")).toBeNull()
  })

  it('shows final selected answers and correctness without rendering a hidden correct answer', async () => {
    const user = userEvent.setup()
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'course-final-1', id: 'course-final-1', title: 'Course final', maxAttempts: 3 }])
    submitQuiz.mockResolvedValueOnce({ score: 0, total: 1, attemptsUsed: 1, maxAttempts: 3, review: [{ selectedAnswer: 1, isCorrect: false }] })
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/course-final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /goodbye/i }))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    await user.click(screen.getByRole('button', { name: 'Submit quiz' }))

    expect((await screen.findByText(/your answer:/i)).parentElement.textContent).toContain('Goodbye')
    expect(screen.getByText('Wrong')).toBeTruthy()
    expect(screen.queryByText(/correct answer:/i)).toBeNull()
    expect(screen.getByText("You're making progress. Try again!")).toBeTruthy()
  })

  it('does not render a Course Final answer key even if an old response still contains it', async () => {
    const user = userEvent.setup()
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'course-final-1', id: 'course-final-1', title: 'Course final', maxAttempts: 3 }])
    submitQuiz.mockResolvedValueOnce({ score: 0, total: 1, attemptsUsed: 3, maxAttempts: 3, review: [{ selectedAnswer: 1, correctAnswer: 0, isCorrect: false }] })
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/course-final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /goodbye/i }))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    await user.click(screen.getByRole('button', { name: 'Submit quiz' }))

    await screen.findByText('Your score')
    expect(screen.getByText('0%')).toBeTruthy()
    expect(screen.getByText('0 / 1 correct')).toBeTruthy()
    expect(screen.getByText('Keep Practicing')).toBeTruthy()
    expect(screen.getByText("You've used all available attempts.")).toBeTruthy()
    expect(screen.queryByText("You're making progress. Try again!")).toBeNull()
    expect(screen.queryByText(/correct answer:/i)).toBeNull()
    expect(document.querySelector('.rounded-full.border-8')).toBeNull()
  })

  it('opens an immutable Lesson attempt review after the live Quiz changes', async () => {
    const user = userEvent.setup()
    fetchQuizHistory.mockResolvedValueOnce({ attempts: [{ _id: 'old-attempt', attemptNumber: 1, score: 0, total: 1, snapshot: { title: 'Earlier lesson', revision: 1, questions: [{ _id: 'old-question', prompt: 'Original Thai greeting', options: ['Sawasdee', 'Goodbye'], image: 'https://example.com/old.jpg', imageAlt: 'Original lesson picture' }] }, review: [{ selectedAnswer: 1, correctAnswer: 0, isCorrect: false }] }], attemptsUsed: 1, maxAttempts: null, bestScore: 0 })
    renderLessonQuiz()
    await user.click(await screen.findByRole('button', { name: /view 1 previous attempt/i }))
    await user.click(screen.getByRole('button', { name: 'Review attempt 1' }))
    expect(screen.getByRole('heading', { name: 'Original Thai greeting' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Original lesson picture' })).toBeTruthy()
    expect(screen.getByText(/correct answer:/i).parentElement.textContent).toContain('Sawasdee')
    expect(screen.getByText('Your score')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back to current quiz' }))
    expect(screen.getByText('Choose hello')).toBeTruthy()
  })

  it('keeps historical Course Final answers hidden even after a legacy reveal marker or +1 grant', async () => {
    const user = userEvent.setup()
    fetchCourseQuizzes.mockResolvedValueOnce([{ ...lessonQuiz, _id: 'final-1', id: 'final-1', maxAttempts: 3, attemptsUsed: 3 }])
    const attempt = { _id: 'final-attempt', attemptNumber: 1, score: 0, total: 1, snapshot: { revision: 1, questions: [{ _id: 'old-question', prompt: 'Original Final wording', options: ['Old correct', 'Old selected'] }] }, review: [{ selectedAnswer: 1, isCorrect: false }] }
    fetchQuizHistory.mockResolvedValueOnce({ attempts: [attempt], attemptsUsed: 3, maxAttempts: 3, bestScore: 0 })
    const view = () => render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)
    const first = view()
    await user.click(await screen.findByRole('button', { name: /view 1 previous attempt/i }))
    await user.click(screen.getByRole('button', { name: 'Review attempt 1' }))
    expect(screen.getByRole('heading', { name: 'Original Final wording' })).toBeTruthy()
    expect(screen.getByText('Wrong')).toBeTruthy()
    expect(screen.queryByText(/correct answer:/i)).toBeNull()
    expect(screen.getByText("You've used all available attempts.")).toBeTruthy()
    first.unmount()
    fetchCourseQuizzes.mockResolvedValueOnce([{ ...lessonQuiz, _id: 'final-1', id: 'final-1', maxAttempts: 4, attemptsUsed: 3 }])
    fetchQuizHistory.mockResolvedValueOnce({ attempts: [{ ...attempt, review: [{ ...attempt.review[0], correctAnswer: 0 }] }], attemptsUsed: 3, maxAttempts: 4, bestScore: 0 })
    view()
    await user.click(await screen.findByRole('button', { name: /view 1 previous attempt/i }))
    await user.click(screen.getByRole('button', { name: 'Review attempt 1' }))
    expect(screen.getByText('Your score')).toBeTruthy()
    expect(screen.queryByText(/correct answer:/i)).toBeNull()
    expect(screen.getByText("You're making progress. Try again!")).toBeTruthy()
  })

  it('returns a lesson quiz result to the exact originating lesson and retains Try again', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/app/learn/course-1/quiz/lesson-1']}><Routes><Route path="/app/learn/:courseId/quiz/:lessonId" element={<><Quiz /><LocationProbe /></>} /><Route path="/app/learn/:courseId" element={<LocationProbe />} /></Routes></MemoryRouter>)

    await submitSingleQuestion(user)
    expect(await screen.findByRole('button', { name: 'Back to Lesson' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back to Lesson' }))
    expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1?lesson=lesson-1')
  })

  it('keeps course-level quiz results on the existing course-level navigation path', async () => {
    const user = userEvent.setup()
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'course-quiz-1', id: 'course-quiz-1', title: 'Course quiz' }])
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/course-quiz-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)

    await submitSingleQuestion(user)
    await screen.findByRole('button', { name: 'Try again' })
    expect(screen.queryByRole('button', { name: 'Back to Lesson' })).toBeNull()
  })

  it('lets an exhausted course-final student request and cancel one extra submission', async () => {
    const user = userEvent.setup()
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'course-final-1', id: 'course-final-1', title: 'Course final', maxAttempts: 3, attemptsUsed: 3 }])
    fetchQuizHistory.mockResolvedValue({ attempts: [], attemptsUsed: 3, maxAttempts: 3, bestScore: 0 })
    createQuizAttemptRequest.mockResolvedValue({ request: { _id: 'request-1', status: 'pending', reason: 'I would like one more chance.', createdAt: '2026-10-05T00:00:00.000Z' } })
    cancelQuizAttemptRequest.mockResolvedValue({ request: { _id: 'request-1', status: 'cancelled', reason: 'I would like one more chance.', createdAt: '2026-10-05T00:00:00.000Z' } })
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/course-final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /request extra submission/i }))
    await user.type(screen.getByRole('textbox', { name: /reason/i }), 'I would like one more chance.')
    await user.click(screen.getByRole('button', { name: /submit request/i }))
    expect(createQuizAttemptRequest).toHaveBeenCalledWith('course-final-1', 'I would like one more chance.')
    expect(await screen.findByText(/waiting for admin review/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /cancel request/i }))
    expect(cancelQuizAttemptRequest).toHaveBeenCalledWith('course-final-1', 'request-1')
    expect(await screen.findByText('Cancelled')).toBeTruthy()
  })

  it('loads the requested Course Final by both route identities and shows a rejection reason', async () => {
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'final-1', id: 'final-1', title: 'Course final', maxAttempts: 3, attemptsUsed: 3 }])
    fetchQuizHistory.mockResolvedValue({ attempts: [], attemptsUsed: 3, maxAttempts: 3, bestScore: 0 })
    fetchQuizAttemptRequests.mockResolvedValue({ requests: [{ _id: 'request-1', status: 'rejected', reason: 'Please review.', adminNote: 'Complete the practice first.', createdAt: '2026-10-05T00:00:00.000Z' }] })
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)

    expect(await screen.findByText('Course final')).toBeTruthy()
    expect(fetchCourseQuizzes).toHaveBeenCalledWith('course-1')
    expect(fetchQuizAttemptRequests).toHaveBeenCalledWith('final-1')
    expect((await screen.findByText(/admin response:/i)).parentElement.textContent).toContain('Complete the practice first.')
  })

  it('keeps an approved request visible while its additional Course Final submission is actionable', async () => {
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'final-1', id: 'final-1', title: 'Course final', maxAttempts: 4, attemptsUsed: 3 }])
    fetchQuizHistory.mockResolvedValue({ attempts: [], attemptsUsed: 3, maxAttempts: 4, bestScore: 0 })
    fetchQuizAttemptRequests.mockResolvedValue({ requests: [{ _id: 'request-1', status: 'approved', reason: 'Please review.', adminNote: 'Approved for one more attempt.', createdAt: '2026-10-05T00:00:00.000Z' }] })
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)

    expect(await screen.findByText('One additional submission was granted.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finish quiz' })).toBeTruthy()
  })

  it('does not autoplay question audio and replays from the beginning from one accessible control', async () => {
    fetchQuizzesForLesson.mockResolvedValue([{ ...lessonQuiz, questions: [{ ...lessonQuiz.questions[0], audio: 'https://example.com/question.mp3', audioLabel: 'Listen first' }] }])
    const user = userEvent.setup()
    renderLessonQuiz()
    const audio = await screen.findByRole('button', { name: 'Play question audio: Listen first' })
    expect(audio.textContent).toBe('Tap to listen')
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    const playButton = screen.getByRole('button', { name: 'Play question audio: Listen first' })
    await user.click(playButton)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    const element = playButton.parentElement.querySelector('audio')
    element.currentTime = 8
    await user.click(playButton)
    expect(element.currentTime).toBe(0)
    expect(screen.queryByRole('slider', { name: /audio progress/i })).toBeNull()
    expect(screen.queryByText(/select the audio control again/i)).toBeNull()
    expect(playButton.className).not.toContain('bg-[#2D2E30]')
  })

  it('opens an image lightbox and restores focus after Escape', async () => {
    const user = userEvent.setup()
    renderLessonQuiz()
    const trigger = await screen.findByRole('button', { name: 'View question image larger' })
    expect(trigger.textContent).toContain('View larger')
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Enlarged question image' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Enlarged question image' })).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('blocks submission for a question whose only meaningful media fails, then exposes Retry', async () => {
    const user = userEvent.setup()
    fetchQuizzesForLesson.mockResolvedValue([{ ...lessonQuiz, questions: [{ ...lessonQuiz.questions[0], prompt: '', image: 'https://example.com/only-media.jpg' }] }])
    renderLessonQuiz()
    const image = await screen.findByRole('img', { name: /quiz question/i })
    fireEvent.error(image)
    await user.click(screen.getByRole('button', { name: /hello/i }))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    expect(await screen.findByText("We couldn't load the image")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(submitQuiz).not.toHaveBeenCalled()
  })

  it('waits for session startup and submits the exact displayed snapshot revision', async () => {
    const user = userEvent.setup()
    let resolveSession
    startQuizSession.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve }))
    fetchQuizzesForLesson.mockResolvedValue([{ ...lessonQuiz, revision: 1, courseContext: { title: 'Travel English' } }])
    renderLessonQuiz()
    await waitFor(() => expect(startQuizSession).toHaveBeenCalledWith('quiz-1'))
    expect(screen.queryByRole('button', { name: 'Finish quiz' })).toBeNull()
    await act(async () => resolveSession({ sessionId: 'real-start', revision: 2, title: 'Hotel Booking', questions: [{ ...lessonQuiz.questions[0], prompt: 'Session wording' }] }))
    expect(await screen.findByText('Session wording')).toBeTruthy()
    expect(screen.getByText('Travel English')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Hotel Booking' })).toBeTruthy()
    expect(screen.queryByText(/lesson assessment/i)).toBeNull()
    await submitSingleQuestion(user)
    await waitFor(() => expect(submitQuiz).toHaveBeenCalledWith('quiz-1', [0], 2, 'real-start'))
    expect(startQuizSession).toHaveBeenCalledTimes(1)
  })

  it('recovers failed startup through the designed retry state', async () => {
    const user = userEvent.setup()
    startQuizSession.mockRejectedValueOnce(new Error('startup temporarily failed'))
    renderLessonQuiz()
    expect(await screen.findByRole('heading', { name: 'Quiz unavailable' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await submitSingleQuestion(user)
    await waitFor(() => expect(submitQuiz).toHaveBeenCalledWith('quiz-1', [0], 1, 'session-1'))
  })

  it('restarts an invalidated session with current questions and revision', async () => {
    const user = userEvent.setup()
    submitQuiz.mockRejectedValueOnce(Object.assign(new Error('no longer available'), { code: 'quiz_session_invalidated', status: 409 }))
    renderLessonQuiz()
    await submitSingleQuestion(user)
    expect(await screen.findByRole('heading', { name: 'This quiz was updated' })).toBeTruthy()
    startQuizSession.mockResolvedValueOnce({ sessionId: 'replacement', revision: 3, questions: [{ ...lessonQuiz.questions[0], prompt: 'Updated question' }] })
    await user.click(screen.getByRole('button', { name: 'Restart quiz' }))
    expect(await screen.findByText('Updated question')).toBeTruthy()
    await submitSingleQuestion(user)
    await waitFor(() => expect(submitQuiz).toHaveBeenLastCalledWith('quiz-1', [0], 3, 'replacement'))
    expect(await screen.findByText('1 / 1 correct')).toBeTruthy()
  })

  it('presents access state using only the authenticated enrollment result', async () => {
    fetchQuizzesForLesson.mockRejectedValueOnce(Object.assign(new Error('Quiz is unavailable.'), { status: 404 }))
    checkEnrollment.mockResolvedValueOnce({ enrolled: false })
    renderLessonQuiz()
    expect(await screen.findByRole('heading', { name: 'Course access required' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to My Courses' }).getAttribute('href')).toBe('/app/courses')
    expect(startQuizSession).not.toHaveBeenCalled()
  })

  it('shows unavailable state when a disabled/archived quiz rejects submission', async () => {
    const user = userEvent.setup()
    submitQuiz.mockRejectedValueOnce(Object.assign(new Error('Quiz is unavailable.'), { code: 'quiz_unavailable', status: 404 }))
    renderLessonQuiz(); await submitSingleQuestion(user)
    expect(await screen.findByRole('heading', { name: 'Quiz unavailable' })).toBeTruthy()
    expect(screen.getByText('This quiz is currently unavailable.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Submit quiz' })).toBeNull()
  })

  it('replays from zero, coordinates question audio and preserves playback during answer selection', async () => {
    const user = userEvent.setup()
    fetchQuizzesForLesson.mockResolvedValue([{ ...lessonQuiz, questions: [
      { ...lessonQuiz.questions[0], audio: 'https://example.com/a.mp3', audioLabel: 'Audio A' },
      { ...lessonQuiz.questions[0], _id: 'question-b', audio: 'https://example.com/b.m4a', audioLabel: 'Audio B' },
    ] }])
    const { container } = renderLessonQuiz()
    await screen.findByRole('button', { name: 'Play question audio: Audio A' })
    const audioA = container.querySelector('audio')
    expect(audioA.autoplay).toBe(false)
    expect(audioA.controls).toBe(false)
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    audioA.currentTime = 7
    await user.click(screen.getByRole('button', { name: 'Play question audio: Audio A' }))
    expect(audioA.currentTime).toBe(0)
    fireEvent.play(audioA)
    expect(screen.getByRole('button', { name: 'Play question audio: Audio A' }).querySelector('svg').getAttribute('class')).toContain('motion-reduce:animate-none')
    audioA.currentTime = 5
    const previousPauses = HTMLMediaElement.prototype.pause.mock.calls.length
    await user.click(screen.getByRole('button', { name: /hello/i }))
    expect(audioA.currentTime).toBe(5)
    expect(HTMLMediaElement.prototype.pause.mock.calls.length).toBe(previousPauses)
    await user.click(screen.getByRole('button', { name: 'Next question' }))
    const audioB = container.querySelector('audio')
    await user.click(screen.getByRole('button', { name: 'Play question audio: Audio B' }))
    expect(HTMLMediaElement.prototype.pause.mock.contexts).toContain(audioA)
    expect(audioA.currentTime).toBe(0)
    expect(audioB.currentTime).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Back', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Play question audio: Audio A' }))
    expect(container.querySelector('audio').currentTime).toBe(0)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByRole('button', { name: /pause|restart|download/i })).toBeNull()
  })

  it.each(['image', 'audio'])('keeps sole-content %s blocked during Retry until loading succeeds', async (kind) => {
    const user = userEvent.setup()
    fetchQuizzesForLesson.mockResolvedValue([{ ...lessonQuiz, questions: [{ ...lessonQuiz.questions[0], prompt: '', image: kind === 'image' ? 'https://example.com/image.jpg' : '', audio: kind === 'audio' ? 'https://example.com/audio.mp3' : '' }] }])
    const { container } = renderLessonQuiz()
    await screen.findByRole('button', { name: /hello/i })
    fireEvent.error(container.querySelector(kind === 'image' ? 'img' : 'audio'))
    await user.click(screen.getByRole('button', { name: /hello/i }))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    expect(submitQuiz).not.toHaveBeenCalled()
    expect(screen.getByText(`We couldn't load the ${kind}`)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    expect(screen.queryByRole('button', { name: 'Submit quiz' })).toBeNull()
    if (kind === 'image') fireEvent.load(container.querySelector('img'))
    else fireEvent.loadedData(container.querySelector('audio'))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    await user.click(screen.getByRole('button', { name: 'Submit quiz' }))
    await waitFor(() => expect(submitQuiz).toHaveBeenCalledTimes(1))
  })

  it('allows sufficient text to remain usable when optional media fails', async () => {
    const user = userEvent.setup(); const { container } = renderLessonQuiz()
    await screen.findByRole('button', { name: /hello/i }); fireEvent.error(container.querySelector('img'))
    await submitSingleQuestion(user)
    await waitFor(() => expect(submitQuiz).toHaveBeenCalledTimes(1))
  })

  it('does not call a normal or expired session an updated Quiz', async () => {
    const user = userEvent.setup()
    fetchQuizzesForLesson.mockResolvedValue([{ ...lessonQuiz, revision: 4 }])
    startQuizSession.mockResolvedValueOnce({ sessionId: 'fresh-session', revision: 4, questions: lessonQuiz.questions })
    renderLessonQuiz()
    await submitSingleQuestion(user)
    await waitFor(() => expect(submitQuiz).toHaveBeenCalledWith('quiz-1', [0], 4, 'fresh-session'))
    expect(screen.queryByRole('heading', { name: 'This quiz was updated' })).toBeNull()
  })

  it('shows a distinct recovery state for an expired session, not a scoring update', async () => {
    const user = userEvent.setup()
    submitQuiz.mockRejectedValueOnce(Object.assign(new Error('Session expired'), { code: 'quiz_session_expired', status: 409 }))
    renderLessonQuiz()
    await submitSingleQuestion(user)
    expect(await screen.findByRole('heading', { name: 'Quiz session ended' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'This quiz was updated' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Restart quiz' }))
    await submitSingleQuestion(user)
    await waitFor(() => expect(submitQuiz).toHaveBeenCalledTimes(2))
  })

  it('asks before leaving an answered Lesson Quiz and clears its draft only on Leave', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/app/learn/course-1/quiz/lesson-1']}><Routes><Route path="/app/learn/:courseId/quiz/:lessonId" element={<><Quiz /><LocationProbe /></>} /><Route path="/app/learn/:courseId" element={<LocationProbe />} /></Routes></MemoryRouter>)
    await screen.findByRole('button', { name: /hello/i })
    const untouchedUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(untouchedUnload)
    expect(untouchedUnload.defaultPrevented).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Leave this quiz?' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /hello/i }))
    await user.click(screen.getByRole('button', { name: /back to lesson/i }))
    expect(await screen.findByRole('dialog', { name: 'Leave this quiz?' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Stay in quiz' }))
    expect(screen.getByRole('button', { name: /hello/i }).className).toContain('bg-[#FFF4D8]')
    await user.click(screen.getByRole('button', { name: /back to lesson/i }))
    await user.click(screen.getByRole('button', { name: 'Leave quiz' }))
    expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1')
    expect(localStorage.getItem('quiz-draft:student-a:course-1:lesson-1:lesson')).toBeNull()
  })

  it('also protects an answered Course Final before navigating away', async () => {
    const user = userEvent.setup()
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'final-1', id: 'final-1', maxAttempts: 3 }])
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<><Quiz /><LocationProbe /></>} /><Route path="/app/learn/:courseId" element={<LocationProbe />} /></Routes></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /hello/i }))
    await user.click(screen.getByRole('button', { name: /back to course/i }))
    expect(await screen.findByRole('dialog', { name: 'Leave this quiz?' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Leave quiz' }))
    expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1')
  })

})
