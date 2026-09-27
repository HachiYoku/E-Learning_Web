import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyCourseCard from '../components/MyCourseCard'
import StudentDashboard from './StudentDashboard'

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Mali' } }) }))
vi.mock('../services/enrollmentService', () => ({ fetchMyEnrollments: vi.fn() }))
vi.mock('../services/flashcardReviewService', () => ({ fetchPersonalReviewSummary: vi.fn() }))

import { fetchMyEnrollments } from '../services/enrollmentService'
import { fetchPersonalReviewSummary } from '../services/flashcardReviewService'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

const progress = {
  completedLessons: 2,
  totalLessons: 5,
  percentage: 40,
  lastOpenedLesson: { id: 'lesson-3', order: 3, title: 'Greetings and Introductions' },
  lastOpenedAt: '2026-09-27T00:00:00.000Z',
}

describe('precise continue learning navigation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fetchPersonalReviewSummary.mockResolvedValue({ dueCount: 0 })
  })

  it('links Today directly to the last opened lesson', async () => {
    fetchMyEnrollments.mockResolvedValue([{ course: { id: 'course-1', title: 'Thai Basics' }, progress }])
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)

    const continueLink = await screen.findByRole('link', { name: /continue learning/i })
    expect(screen.getByText('Lesson 3 · Greetings and Introductions')).toBeTruthy()
    expect(continueLink.getAttribute('href')).toBe('/app/learn/course-1?lesson=lesson-3')
    expect(screen.getByText('40% complete')).toBeTruthy()
    expect(screen.getByText('2 of 5 lessons')).toBeTruthy()
  })

  it('presents completed courses as reviewable without changing the resume URL', async () => {
    fetchMyEnrollments.mockResolvedValue([{ course: { id: 'course-1', title: 'Thai Basics' }, progress: { ...progress, completedLessons: 5, totalLessons: 5, percentage: 100 } }])
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)
    const reviewLink = await screen.findByRole('link', { name: /review course/i })
    expect(screen.getByText(/course completed/i)).toBeTruthy()
    expect(screen.getByText('100% complete')).toBeTruthy()
    expect(reviewLink.getAttribute('href')).toBe('/app/learn/course-1?lesson=lesson-3')
  })

  it('keeps the new-student journey separate from a failed enrollment request', async () => {
    const user = userEvent.setup()
    fetchMyEnrollments.mockRejectedValueOnce(new Error("Couldn't load your learning progress.")).mockResolvedValueOnce([])
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(/start your journey/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /^retry$/i }))
    expect(await screen.findByText(/start your journey/i)).toBeTruthy()
    expect(fetchMyEnrollments).toHaveBeenCalledTimes(2)
  })

  it('shows the empty enrollment journey only after a successful empty response', async () => {
    fetchMyEnrollments.mockResolvedValue([])
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)
    expect(await screen.findByText(/start your journey/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /browse courses/i }).getAttribute('href')).toBe('/courses')
  })

  it('shows plural due review state with a Start Review link', async () => {
    fetchMyEnrollments.mockResolvedValue([])
    fetchPersonalReviewSummary.mockResolvedValueOnce({ dueCount: 6 })
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)
    expect(await screen.findByText('6 flashcards ready to review')).toBeTruthy()
    expect(screen.getByRole('link', { name: /start review/i }).getAttribute('href')).toBe('/app/practice/flashcards/review')
  })

  it('uses singular review grammar', async () => {
    fetchMyEnrollments.mockResolvedValue([])
    fetchPersonalReviewSummary.mockResolvedValueOnce({ dueCount: 1 })
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)
    expect(await screen.findByText('1 flashcard ready to review')).toBeTruthy()
    expect(screen.getByRole('link', { name: /start review/i })).toBeTruthy()
  })

  it('shows a quiet caught-up state with no disabled review action', async () => {
    fetchMyEnrollments.mockResolvedValue([])
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)
    expect(await screen.findByText(/you're all caught up/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /start review/i })).toBeNull()
  })

  it('keeps Continue Learning available when review summary fails and retries only review summary', async () => {
    const user = userEvent.setup()
    fetchMyEnrollments.mockResolvedValue([{ course: { id: 'course-1', title: 'Thai Basics' }, progress }])
    fetchPersonalReviewSummary.mockRejectedValueOnce(new Error("Couldn't load your flashcard review status.")).mockResolvedValueOnce({ dueCount: 0 })
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)
    expect(await screen.findByRole('link', { name: /continue learning/i })).toBeTruthy()
    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^retry$/i }))
    expect(await screen.findByText(/you're all caught up/i)).toBeTruthy()
    expect(fetchMyEnrollments).toHaveBeenCalledTimes(1)
    expect(fetchPersonalReviewSummary).toHaveBeenCalledTimes(2)
  })

  it('keeps Flashcard Review available when enrollment loading fails', async () => {
    fetchMyEnrollments.mockRejectedValueOnce(new Error('Enrollment unavailable'))
    fetchPersonalReviewSummary.mockResolvedValueOnce({ dueCount: 2 })
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)
    expect(await screen.findByText('2 flashcards ready to review')).toBeTruthy()
    expect(screen.getByRole('link', { name: /start review/i })).toBeTruthy()
  })

  it('uses the same precise URL when My Courses resumes a course', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/app/courses']}><MyCourseCard id="course-1" title="Thai Basics" description="" progress={progress} buttonText="Continue" /><LocationProbe /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1?lesson=lesson-3')
  })
})
