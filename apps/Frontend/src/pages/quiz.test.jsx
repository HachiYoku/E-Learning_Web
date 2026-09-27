import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Quiz from './Quiz'

vi.mock('../components/Navbar', () => ({ default: () => <nav>Student navigation</nav> }))
vi.mock('../components/Footer', () => ({ default: () => <footer>Student footer</footer> }))
vi.mock('../components/LoadingSpinner', () => ({ default: () => <p>Loading</p> }))
vi.mock('../services/quizService', () => ({ fetchQuizzesForLesson: vi.fn(), fetchCourseQuizzes: vi.fn(), fetchQuizHistory: vi.fn(), submitQuiz: vi.fn() }))

import { fetchCourseQuizzes, fetchQuizHistory, fetchQuizzesForLesson, submitQuiz } from '../services/quizService'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
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
    fetchQuizzesForLesson.mockResolvedValue([lessonQuiz])
    fetchQuizHistory.mockResolvedValue({ attempts: [], attemptsUsed: 0, maxAttempts: null, bestScore: 0 })
    submitQuiz.mockResolvedValue({ score: 1, total: 1, showCorrectAnswers: false, attemptsUsed: 1, maxAttempts: null })
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
})
