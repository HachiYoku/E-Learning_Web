import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeneralPracticeList from './GeneralPracticeList'
import GeneralPracticeDetails from './GeneralPracticeDetails'

vi.mock('../../services/generalPracticeAdminService', () => ({ fetchGeneralPracticeQuizzes: vi.fn(), fetchGeneralPracticeQuiz: vi.fn(), publishGeneralPracticeDraft: vi.fn(), disableGeneralPracticeQuiz: vi.fn(), enableGeneralPracticeQuiz: vi.fn(), archiveGeneralPracticeQuiz: vi.fn(), retryGeneralPracticeMedia: vi.fn() }))
import { fetchGeneralPracticeQuizzes, fetchGeneralPracticeQuiz } from '../../services/generalPracticeAdminService'

const quiz = {
  id: 'quiz-1', contextType: 'standalone', status: 'published', mediaProcessing: 'complete',
  published: { title: 'Thai greetings', category: 'Vocabulary', difficulty: 'Beginner', standaloneAccess: 'public', revision: 1, questions: [{ prompt: 'Private answer', options: ['Correct choice', 'Other choice'], correctAnswer: 0, explanation: 'Published explanation' }] },
  draft: { title: 'Updated greetings', category: 'Vocabulary', difficulty: 'Intermediate', standaloneAccess: 'students', version: 2, questions: [{ prompt: 'Draft question', options: ['One', 'Two'], correctAnswer: 1, explanation: 'Draft explanation' }] },
}

function renderPages(path = '/general-practice/quizzes') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/general-practice/quizzes" element={<GeneralPracticeList />} /><Route path="/general-practice/:quizId" element={<GeneralPracticeDetails />} /></Routes></MemoryRouter>)
}

describe('Admin General Practice read-only views', () => {
  beforeEach(() => { vi.resetAllMocks(); fetchGeneralPracticeQuizzes.mockResolvedValue([quiz]); fetchGeneralPracticeQuiz.mockResolvedValue(quiz) })

  it('shows loading, published metadata, draft version and a read-only details link', async () => {
    let complete
    fetchGeneralPracticeQuizzes.mockReturnValue(new Promise((resolve) => { complete = resolve }))
    renderPages()
    expect(screen.getByRole('status').textContent).toMatch(/Loading General Practice/i)
    complete([quiz])
    expect(await screen.findByText('Thai greetings')).toBeTruthy()
    expect(screen.getByText('Public')).toBeTruthy()
    expect(screen.getByText(/Draft version: 2/)).toBeTruthy()
    expect(screen.queryByText('Private answer')).toBeNull()
    expect(screen.queryByRole('button', { name: /create|publish|archive/i })).toBeNull()
    await userEvent.setup().click(screen.getByRole('link', { name: 'View details for Thai greetings' }))
    expect(await screen.findByText('Updated greetings')).toBeTruthy()
    expect(fetchGeneralPracticeQuiz).toHaveBeenCalledWith('quiz-1')
    expect(screen.getByText('Private answer')).toBeTruthy()
    expect(screen.getByText('Correct answer')).toBeTruthy()
    expect(screen.getByText(/Published explanation/)).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Draft Preview' }))
    expect(screen.getByText('Draft question')).toBeTruthy()
    expect(screen.getByText(/Draft explanation/)).toBeTruthy()
    expect(screen.queryByText('Private answer')).toBeNull()
  })

  it('shows an empty state without offering the incompatible old creation endpoint', async () => {
    fetchGeneralPracticeQuizzes.mockResolvedValue([])
    renderPages()
    expect(await screen.findByText('No General Practice quizzes yet')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Create quiz' })).toBeNull()
    expect(screen.getByText(/New quizzes must be created within a Quiz Set/)).toBeTruthy()
  })

  it('shows an API error and an unauthorized message', async () => {
    fetchGeneralPracticeQuizzes.mockRejectedValue(Object.assign(new Error('Unavailable'), { status: 503 }))
    const first = renderPages()
    expect((await screen.findByRole('alert')).textContent).toBe('Unavailable')
    first.unmount()
    fetchGeneralPracticeQuizzes.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    renderPages()
    expect((await screen.findByRole('alert')).textContent).toMatch(/Admin access is required/)
  })

  it('shows a missing quiz error without exposing private content', async () => {
    fetchGeneralPracticeQuiz.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
    renderPages('/general-practice/missing')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not found/i))
    expect(screen.queryByText('Private answer')).toBeNull()
  })
})
