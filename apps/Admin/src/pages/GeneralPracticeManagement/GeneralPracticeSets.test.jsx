import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeneralPracticeSetList from './GeneralPracticeSetList'
import GeneralPracticeSetDetails from './GeneralPracticeSetDetails'

vi.mock('../../services/generalPracticeAdminService', () => ({
  fetchGeneralPracticeSets: vi.fn(), fetchGeneralPracticeSet: vi.fn(), isSafeQuizSetCoverImage: vi.fn(() => false),
  updateGeneralPracticeSet: vi.fn(), transitionGeneralPracticeSet: vi.fn(), deleteGeneralPracticeSet: vi.fn(),
}))
import { fetchGeneralPracticeSets, fetchGeneralPracticeSet } from '../../services/generalPracticeAdminService'

const setId = '507f1f77bcf86cd799439011'
const set = { id: setId, name: 'Thai basics', description: 'Learn daily expressions',
  difficulty: 'Beginner', coverImage: '', displayOrder: 2, status: 'active', version: 1 }
const quiz = { id: '507f1f77bcf86cd799439012', title: 'Greetings', status: 'published',
  sortOrder: 1, standaloneAccess: 'students', category: 'Vocabulary', difficulty: 'Beginner',
  publishedRevision: 1, draftVersion: null }

function QuizDestination() {
  const location = useLocation()
  return <p>Quiz destination from {location.state?.fromSet?.name || 'unknown Set'}</p>
}

function renderPages(path = '/general-practice') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/general-practice" element={<GeneralPracticeSetList />} />
    <Route path="/general-practice/sets/:setId" element={<GeneralPracticeSetDetails />} />
    <Route path="/general-practice/:quizId" element={<QuizDestination />} />
  </Routes></MemoryRouter>)
}

describe('Admin General Practice Quiz Set read-only views', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fetchGeneralPracticeSets.mockResolvedValue([set])
    fetchGeneralPracticeSet.mockResolvedValue({ set, quizzes: [quiz] })
  })

  it('shows loading, Backend order, and all Set lifecycle statuses', async () => {
    let finish
    fetchGeneralPracticeSets.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderPages()
    expect(screen.getByRole('status').textContent).toMatch(/Loading Quiz Sets/)
    finish([{ ...set, status: 'active' }, { ...set, id: 'disabled', name: 'Disabled Set', status: 'disabled', displayOrder: 3 },
      { ...set, id: 'archived', name: 'Archived Set', status: 'archived', displayOrder: 4 }])
    expect(await screen.findByRole('heading', { name: 'Thai basics' })).toBeTruthy()
    expect(screen.getByText('Disabled Set')).toBeTruthy()
    expect(screen.getByText('Archived Set')).toBeTruthy()
    const cards = screen.getAllByRole('article')
    expect(cards.map((card) => card.querySelector('h2').textContent)).toEqual(['Thai basics', 'Disabled Set', 'Archived Set'])
    expect(screen.getByRole('link', { name: 'Create Quiz Set' })).toBeTruthy()
  })

  it('handles an empty catalog and absent optional metadata', async () => {
    fetchGeneralPracticeSets.mockResolvedValueOnce([])
    const first = renderPages()
    expect(await screen.findByText('No Quiz Sets yet')).toBeTruthy()
    first.unmount()
    fetchGeneralPracticeSets.mockResolvedValueOnce([{ ...set, description: '', coverImage: '', difficulty: null }])
    renderPages()
    expect(await screen.findByText('All levels')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows an active empty Set as Quizzes coming soon', async () => {
    fetchGeneralPracticeSet.mockResolvedValue({ set, quizzes: [] })
    renderPages(`/general-practice/sets/${setId}`)
    expect(await screen.findByRole('heading', { name: 'Quizzes coming soon' })).toBeTruthy()
    expect(screen.getByText('Set: active')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Disable Set' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete empty Set' })).toBeNull()
  })

  it('distinguishes Set and quiz status, and retains navigation context', async () => {
    fetchGeneralPracticeSet.mockResolvedValue({ set: { ...set, status: 'disabled' }, quizzes: [quiz] })
    renderPages(`/general-practice/sets/${setId}`)
    expect(await screen.findByText('Set: disabled')).toBeTruthy()
    expect(screen.getByText('Quiz: published')).toBeTruthy()
    expect(screen.getByText(/Students Only/)).toBeTruthy()
    expect(screen.getByText(/Published revision: 1/)).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('link', { name: 'View details for Greetings' }))
    expect(screen.getByText('Quiz destination from Thai basics')).toBeTruthy()
  })

  it.each([
    [401, /Admin access is required/], [403, /Admin access is required/],
    [404, /not found/], [503, /Server unavailable/],
  ])('reports HTTP %s Set-detail errors safely', async (status, message) => {
    fetchGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Server unavailable'), { status }))
    renderPages(`/general-practice/sets/${setId}`)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(message))
    expect(screen.queryByText('Greetings')).toBeNull()
  })

  it('reports Set-list network failures without inventing content', async () => {
    fetchGeneralPracticeSets.mockRejectedValue(new Error('Network unavailable'))
    renderPages()
    expect((await screen.findByRole('alert')).textContent).toMatch(/Network unavailable/)
    expect(screen.queryByRole('heading', { name: 'Thai basics' })).toBeNull()
  })
})
