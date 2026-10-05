import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Quiz from './Quiz'

const { authState } = vi.hoisted(() => ({ authState: { user: { id: 'student-a' } } }))
const storage = new Map()

vi.mock('../components/Navbar', () => ({ default: () => <nav>Student navigation</nav> }))
vi.mock('../components/Footer', () => ({ default: () => <footer>Student footer</footer> }))
vi.mock('../components/LoadingSpinner', () => ({ default: () => <p>Loading</p> }))
vi.mock('../services/quizService', () => ({ fetchQuizzesForLesson: vi.fn(), fetchCourseQuizzes: vi.fn(), fetchQuizHistory: vi.fn(), submitQuiz: vi.fn(), fetchQuizAttemptRequests: vi.fn(), createQuizAttemptRequest: vi.fn(), cancelQuizAttemptRequest: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }))

import { fetchCourseQuizzes, fetchQuizHistory, fetchQuizzesForLesson, submitQuiz, fetchQuizAttemptRequests, createQuizAttemptRequest, cancelQuizAttemptRequest } from '../services/quizService'

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
    submitQuiz.mockResolvedValue({ score: 1, total: 1, showCorrectAnswers: false, attemptsUsed: 1, maxAttempts: null })
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
  })

  it('renders a revealed correct answer when the server supplies it for a final quiz', async () => {
    const user = userEvent.setup()
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'course-final-1', id: 'course-final-1', title: 'Course final', maxAttempts: 3 }])
    submitQuiz.mockResolvedValueOnce({ score: 0, total: 1, attemptsUsed: 3, maxAttempts: 3, review: [{ selectedAnswer: 1, correctAnswer: 0, isCorrect: false }] })
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/course-final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /goodbye/i }))
    await user.click(screen.getByRole('button', { name: 'Finish quiz' }))
    await user.click(screen.getByRole('button', { name: 'Submit quiz' }))

    expect((await screen.findByText(/correct answer:/i)).parentElement.textContent).toContain('Hello')
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
    expect(screen.getByText(/admin response:/i).parentElement.textContent).toContain('Complete the practice first.')
  })

  it('keeps an approved request visible while its additional Course Final submission is actionable', async () => {
    fetchCourseQuizzes.mockResolvedValue([{ ...lessonQuiz, _id: 'final-1', id: 'final-1', title: 'Course final', maxAttempts: 4, attemptsUsed: 3 }])
    fetchQuizHistory.mockResolvedValue({ attempts: [], attemptsUsed: 3, maxAttempts: 4, bestScore: 0 })
    fetchQuizAttemptRequests.mockResolvedValue({ requests: [{ _id: 'request-1', status: 'approved', reason: 'Please review.', adminNote: 'Approved for one more attempt.', createdAt: '2026-10-05T00:00:00.000Z' }] })
    render(<MemoryRouter initialEntries={['/app/course-quiz/course-1/final-1']}><Routes><Route path="/app/course-quiz/:courseId/:quizId" element={<Quiz />} /></Routes></MemoryRouter>)

    expect(await screen.findByText('One additional submission was granted.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finish quiz' })).toBeTruthy()
  })
})
