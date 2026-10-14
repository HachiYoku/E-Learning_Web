import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeneralPracticeEditor from './GeneralPracticeEditor'

vi.mock('../../services/generalPracticeAdminService', () => ({ fetchGeneralPracticeQuiz: vi.fn(), createGeneralPracticeDraft: vi.fn(), updateGeneralPracticeDraft: vi.fn() }))
import { createGeneralPracticeDraft, fetchGeneralPracticeQuiz, updateGeneralPracticeDraft } from '../../services/generalPracticeAdminService'

const saved = {
  id: 'quiz-1', contextType: 'standalone', status: 'published', published: { title: 'Live title', revision: 2, questions: [] },
  draft: { title: 'Draft title', description: '', category: 'Vocabulary', difficulty: 'Beginner', standaloneAccess: 'students', version: 3,
    questions: [{ _id: 'q1', prompt: 'Greeting?', options: ['Hello', 'Goodbye'], correctAnswer: 0, explanation: '' }] },
}

function renderEditor(path = '/general-practice/new') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/general-practice/new" element={<GeneralPracticeEditor />} /><Route path="/general-practice/:quizId/edit" element={<GeneralPracticeEditor />} /><Route path="/general-practice" element={<p>Quiz list</p>} /></Routes></MemoryRouter>)
}

describe('General Practice draft editor', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); fetchGeneralPracticeQuiz.mockResolvedValue(saved) })

  it('rejects invalid edits before calling the API', async () => {
    renderEditor('/general-practice/quiz-1/edit')
    await screen.findByDisplayValue('Draft title')
    await userEvent.setup().clear(screen.getByRole('textbox', { name: 'Title' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByRole('alert').textContent).toMatch(/Enter a quiz title/)
    expect(updateGeneralPracticeDraft).not.toHaveBeenCalled()
  })

  it('guards the direct new-quiz URL until Set-scoped creation is implemented', async () => {
    renderEditor()
    expect(screen.getByRole('heading', { name: 'Quiz creation is not available yet' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(createGeneralPracticeDraft).not.toHaveBeenCalled()
    expect(updateGeneralPracticeDraft).not.toHaveBeenCalled()
  })

  it('loads a draft, edits an answer, and saves against its version without publishing', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeDraft.mockResolvedValue({ ...saved, draft: { ...saved.draft, version: 4 } })
    renderEditor('/general-practice/quiz-1/edit')
    expect(await screen.findByDisplayValue('Draft title')).toBeTruthy()
    expect(screen.getByText(/Published revision 2 stays unchanged/)).toBeTruthy()
    await user.clear(screen.getByRole('textbox', { name: 'Option 2' }))
    await user.type(screen.getByRole('textbox', { name: 'Option 2' }), 'Farewell')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(updateGeneralPracticeDraft).toHaveBeenCalledWith('quiz-1', 3, expect.objectContaining({ questions: [expect.objectContaining({ options: ['Hello', 'Farewell'] })] })))
    expect(screen.getByRole('status').textContent).toMatch(/not been published/)
  })

  it('starts an unpublished draft from published content at expectedVersion zero and preserves media', async () => {
    const user = userEvent.setup()
    const publishedOnly = { ...saved, draft: null, published: { ...saved.draft, revision: 2, questions: [{ ...saved.draft.questions[0], image: 'owned-url', imagePublicId: 'owned-id', imageAlt: 'Greeting image' }] } }
    fetchGeneralPracticeQuiz.mockResolvedValue(publishedOnly)
    updateGeneralPracticeDraft.mockResolvedValue({ ...publishedOnly, draft: { ...publishedOnly.published, version: 1 } })
    renderEditor('/general-practice/quiz-1/edit')
    expect(await screen.findByDisplayValue('Draft title')).toBeTruthy()
    expect(screen.getByText(/Existing image/)).toBeTruthy()
    await user.type(screen.getByRole('textbox', { name: 'Explanation (optional)' }), 'A greeting')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(updateGeneralPracticeDraft).toHaveBeenCalledWith('quiz-1', 0, expect.objectContaining({ questions: [expect.objectContaining({ image: 'owned-url', imagePublicId: 'owned-id', explanation: 'A greeting' })] })))
  })

  it('preserves edits on a stale-version conflict and reloads only after confirmation', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeDraft.mockRejectedValue(Object.assign(new Error('Changed'), { status: 409 }))
    renderEditor('/general-practice/quiz-1/edit')
    await screen.findByDisplayValue('Draft title')
    await user.type(screen.getByRole('textbox', { name: 'Title' }), ' updated')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed elsewhere/)
    expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('Draft title updated')
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(true)
    window.confirm.mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Reload latest saved draft' }))
    expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('Draft title updated')
    window.confirm.mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Reload latest saved draft' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('Draft title'))
  })

  it('keeps edits after network or authorization failures without claiming a save', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeDraft.mockRejectedValueOnce(new Error('Network error')).mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    renderEditor('/general-practice/quiz-1/edit')
    await screen.findByDisplayValue('Draft title')
    await user.type(screen.getByRole('textbox', { name: 'Title' }), ' changed')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/outcome is uncertain/)
    expect(screen.queryByText(/Draft saved/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Reload latest saved draft' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('Draft title'))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), ' changed')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Admin access is required/)
    expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('Draft title changed')
  })

  it('retains form content after a backend validation error', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeDraft.mockRejectedValue(Object.assign(new Error('Check the quiz metadata and questions.'), { status: 400 }))
    renderEditor('/general-practice/quiz-1/edit')
    await screen.findByDisplayValue('Draft title')
    await user.type(screen.getByRole('textbox', { name: 'Title' }), ' changed')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Check the quiz metadata/)
    expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('Draft title changed')
  })

  it('does not save from a direct editor URL while media reconciliation is pending', async () => {
    fetchGeneralPracticeQuiz.mockResolvedValue({ ...saved, mediaProcessing: 'retry_required' })
    renderEditor('/general-practice/quiz-1/edit')
    expect(await screen.findByText(/Media processing must be retried/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(true)
    expect(updateGeneralPracticeDraft).not.toHaveBeenCalled()
  })

  it('can add, reorder, and remove questions and options', async () => {
    const user = userEvent.setup()
    renderEditor('/general-practice/quiz-1/edit')
    await screen.findByDisplayValue('Draft title')
    await user.click(screen.getByRole('button', { name: 'Add question' }))
    expect(screen.getAllByRole('heading', { name: /Question [12]/ })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Move question 2 up' }))
    const first = screen.getByRole('region', { name: 'Question 1' })
    expect(within(first).getByRole('textbox', { name: 'Question text' }).value).toBe('')
    await user.click(screen.getByRole('button', { name: 'Remove question 1' }))
    expect(screen.getAllByRole('heading', { name: /Question [12]/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Add option' }))
    expect(screen.getByRole('textbox', { name: 'Option 3' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Remove option 3 from question 1' }))
    expect(screen.queryByRole('textbox', { name: 'Option 3' })).toBeNull()
  })
})
