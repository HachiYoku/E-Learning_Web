import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyCourseCard from '../components/MyCourseCard'
import StudentDashboard from './StudentDashboard'

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Mali' } }) }))
vi.mock('../services/enrollmentService', () => ({ fetchMyEnrollments: vi.fn() }))

import { fetchMyEnrollments } from '../services/enrollmentService'

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
  })

  it('links Today directly to the last opened lesson', async () => {
    fetchMyEnrollments.mockResolvedValue([{ course: { id: 'course-1', title: 'Thai Basics' }, progress }])
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>)

    const continueLink = await screen.findByRole('link', { name: /continue learning/i })
    expect(screen.getByText('Lesson 3 · Greetings and Introductions')).toBeTruthy()
    expect(continueLink.getAttribute('href')).toBe('/app/learn/course-1?lesson=lesson-3')
  })

  it('uses the same precise URL when My Courses resumes a course', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/app/courses']}><MyCourseCard id="course-1" title="Thai Basics" description="" progress={progress} buttonText="Continue" /><LocationProbe /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByTestId('location').textContent).toBe('/app/learn/course-1?lesson=lesson-3')
  })
})
