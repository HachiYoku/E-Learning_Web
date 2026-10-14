import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeneralPracticeEditor from './GeneralPracticeEditor'

const auth = vi.hoisted(() => ({ user: { id: '507f1f77bcf86cd799439099', role: 'admin' } }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }))

vi.mock('../../services/generalPracticeAdminService', () => ({ fetchGeneralPracticeQuiz: vi.fn(), fetchGeneralPracticeSet: vi.fn(), createGeneralPracticeDraft: vi.fn(), createGeneralPracticeSetDraft: vi.fn(), updateGeneralPracticeDraft: vi.fn() }))
import { createGeneralPracticeDraft, createGeneralPracticeSetDraft, fetchGeneralPracticeQuiz, fetchGeneralPracticeSet, updateGeneralPracticeDraft } from '../../services/generalPracticeAdminService'

const setId = '507f1f77bcf86cd799439011'
const createdId = '507f1f77bcf86cd799439012'
const requestId = '550e8400-e29b-41d4-a716-446655440000'
const parentSet = { id: setId, name: 'Thai basics', status: 'active' }

const saved = {
  id: 'quiz-1', contextType: 'standalone', status: 'published', published: { title: 'Live title', revision: 2, questions: [] },
  draft: { title: 'Draft title', description: '', category: 'Vocabulary', difficulty: 'Beginner', standaloneAccess: 'students', version: 3,
    questions: [{ _id: 'q1', prompt: 'Greeting?', options: ['Hello', 'Goodbye'], correctAnswer: 0, explanation: '' }] },
}

function renderEditor(path = '/general-practice/new') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/general-practice/new" element={<GeneralPracticeEditor />} /><Route path="/general-practice/sets/:setId/quizzes/new" element={<GeneralPracticeEditor />} /><Route path="/general-practice/sets/:setId" element={<p>Quiz Set list</p>} /><Route path="/general-practice/:quizId/edit" element={<GeneralPracticeEditor />} /><Route path="/general-practice/:quizId" element={<p>Created quiz details</p>} /><Route path="/general-practice" element={<p>Quiz list</p>} /></Routes></MemoryRouter>)
}

async function fillNewDraft(user) {
  await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Greetings')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'Vocabulary')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Difficulty' }), 'Beginner')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Visibility' }), 'public')
  await user.type(screen.getByRole('textbox', { name: 'Question text' }), 'Hello in Thai?')
  await user.type(screen.getByRole('textbox', { name: 'Option 1' }), 'Sawasdee')
  await user.type(screen.getByRole('textbox', { name: 'Option 2' }), 'Goodbye')
  await user.click(screen.getAllByRole('radio', { name: 'Correct' })[0])
}

describe('General Practice draft editor', () => {
  beforeEach(() => { vi.resetAllMocks(); window.sessionStorage.clear(); auth.user = { id: '507f1f77bcf86cd799439099', role: 'admin' }; vi.spyOn(window, 'confirm').mockReturnValue(true); vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(requestId); fetchGeneralPracticeQuiz.mockResolvedValue(saved); fetchGeneralPracticeSet.mockResolvedValue({ set: parentSet, quizzes: [] }) })

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
    expect(screen.getByRole('heading', { name: 'Choose a Quiz Set to create a quiz' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(createGeneralPracticeDraft).not.toHaveBeenCalled()
    expect(updateGeneralPracticeDraft).not.toHaveBeenCalled()
  })

  it('uses the fixed Set context and creates one draft without a second save', async () => {
    const user = userEvent.setup()
    createGeneralPracticeSetDraft.mockResolvedValue({ id: createdId, quizSetId: setId, status: 'draft', sortOrder: 1, draft: { version: 1, questions: [{}] } })
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    expect((await screen.findByText(/Quiz Set:/)).textContent).toContain('Thai basics')
    expect(screen.queryByRole('combobox', { name: /Quiz Set/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByRole('alert').textContent).toMatch(/Enter a quiz title/)
    expect(createGeneralPracticeSetDraft).not.toHaveBeenCalled()
    await fillNewDraft(user)
    await user.dblClick(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(screen.getByText('Created quiz details')).toBeTruthy())
    expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(1)
    expect(createGeneralPracticeSetDraft).toHaveBeenCalledWith(setId, requestId, expect.objectContaining({ title: 'Greetings', standaloneAccess: 'public', questions: [expect.objectContaining({ correctAnswer: 0 })] }))
    expect(updateGeneralPracticeDraft).not.toHaveBeenCalled()
  })

  it('does not dispatch parallel create requests while the first request is pending', async () => {
    const user = userEvent.setup()
    let finish
    createGeneralPracticeSetDraft.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.dblClick(screen.getByRole('button', { name: 'Save draft' }))
    expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Saving...' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Back to Quiz Set' }).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Back to Quiz Set' }))
    expect(screen.queryByText('Quiz Set list')).toBeNull()
    expect(window.confirm).not.toHaveBeenCalled()
    finish({ id: createdId, quizSetId: setId, status: 'draft', sortOrder: 1, draft: { version: 1, questions: [{}] } })
    expect(await screen.findByText('Created quiz details')).toBeTruthy()
    expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(1)
  })

  it('rejects archived, missing, invalid and unauthorized Set context before posting', async () => {
    fetchGeneralPracticeSet.mockResolvedValueOnce({ set: { ...parentSet, status: 'archived' }, quizzes: [] })
    const archived = renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Archived Quiz Sets/)
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    archived.unmount()
    renderEditor('/general-practice/sets/bad-id/quizzes/new')
    expect((await screen.findByRole('alert')).textContent).toMatch(/link is invalid/)
    expect(fetchGeneralPracticeSet).toHaveBeenCalledTimes(1)
    expect(createGeneralPracticeSetDraft).not.toHaveBeenCalled()
  })

  it.each([[401, /Admin access/], [403, /Admin access/], [404, /not found/], [503, /unavailable/]])('handles Set loading HTTP %s', async (status, message) => {
    fetchGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Service unavailable'), { status }))
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    expect((await screen.findByRole('alert')).textContent).toMatch(message)
    expect(createGeneralPracticeSetDraft).not.toHaveBeenCalled()
  })

  it.each([[400, /Invalid draft/], [401, /Admin access/], [403, /Admin access/], [404, /no longer available/], [409, /conflicts/]])('preserves a new draft after HTTP %s', async (status, message) => {
    const user = userEvent.setup()
    createGeneralPracticeSetDraft.mockRejectedValue(Object.assign(new Error(status === 400 ? 'Invalid draft' : 'Set not found'), { status }))
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(message)
    expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('Greetings')
  })

  it.each(['network', '503', 'malformed'])('locks uncertain %s creation and offers exact-request recovery', async (kind) => {
    const user = userEvent.setup()
    if (kind === 'malformed') createGeneralPracticeSetDraft.mockResolvedValue({ id: createdId, quizSetId: setId, status: 'draft' })
    else createGeneralPracticeSetDraft.mockRejectedValue(kind === '503' ? Object.assign(new Error('Unavailable'), { status: 503 }) : new Error('Network failed'))
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Check the Set quiz list|Check the Set quiz list/)
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Retry same request' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(false)
    await user.click(screen.getByRole('button', { name: "Check this Set's quiz list" }))
    expect(screen.getByText('Quiz Set list')).toBeTruthy()
    expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(1)
  })

  it('retries the frozen request after a lost response and clears recovery after a 201 replay', async () => {
    const user = userEvent.setup()
    createGeneralPracticeSetDraft.mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({ id: createdId, quizSetId: setId, status: 'draft', sortOrder: 1, draft: { version: 1, questions: [{}] } })
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByRole('button', { name: 'Retry same request' })
    const original = createGeneralPracticeSetDraft.mock.calls[0]
    expect(original[1]).toBe(requestId)
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.length).toBe(1)
    expect(screen.getByRole('textbox', { name: 'Title' }).closest('fieldset').disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Retry same request' }))
    expect(await screen.findByText('Created quiz details')).toBeTruthy()
    expect(createGeneralPracticeSetDraft.mock.calls[1]).toEqual(original)
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('recovers after same-tab refresh without automatically resubmitting', async () => {
    const user = userEvent.setup()
    createGeneralPracticeSetDraft.mockRejectedValue(new Error('Network timeout'))
    const first = renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByRole('button', { name: 'Retry same request' })
    const original = createGeneralPracticeSetDraft.mock.calls[0]
    first.unmount()
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByRole('button', { name: 'Retry same request' })
    expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('Greetings')
    expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Retry same request' }))
    await waitFor(() => expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(2))
    expect(createGeneralPracticeSetDraft.mock.calls[1]).toEqual(original)
  })

  it('keeps repeated failures recoverable and requires confirmation to abandon', async () => {
    const user = userEvent.setup()
    createGeneralPracticeSetDraft.mockRejectedValue(new Error('Network timeout'))
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByRole('button', { name: 'Retry same request' })
    await user.click(screen.getByRole('button', { name: 'Retry same request' }))
    await waitFor(() => expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(2))
    expect(window.sessionStorage.length).toBe(1)
    window.confirm.mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Abandon recovery' }))
    expect(window.sessionStorage.length).toBe(1)
    window.confirm.mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Abandon recovery' }))
    expect(window.sessionStorage.length).toBe(0)
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(false)
    expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(2)
  })

  it('keeps 409 for investigation and does not offer a fresh request', async () => {
    const user = userEvent.setup()
    createGeneralPracticeSetDraft.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409 }))
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/conflicts/)
    expect(screen.queryByRole('button', { name: 'Retry same request' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(true)
    expect(window.sessionStorage.length).toBe(1)
  })

  it('uses a new UUID only after a rejected request is cleared and a new operation begins', async () => {
    const user = userEvent.setup()
    const nextId = '550e8400-e29b-41d4-a716-446655440001'
    globalThis.crypto.randomUUID.mockReturnValueOnce(requestId).mockReturnValueOnce(nextId)
    createGeneralPracticeSetDraft.mockRejectedValueOnce(Object.assign(new Error('Invalid draft'), { status: 400 }))
      .mockResolvedValueOnce({ id: createdId, quizSetId: setId, status: 'draft', sortOrder: 1, draft: { version: 1, questions: [{}] } })
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Invalid draft/)
    expect(window.sessionStorage.length).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Created quiz details')).toBeTruthy()
    expect(createGeneralPracticeSetDraft.mock.calls.map((call) => call[1])).toEqual([requestId, nextId])
  })

  it('does not reuse another authenticated Admin’s valid pending request', async () => {
    const user = userEvent.setup()
    createGeneralPracticeSetDraft.mockRejectedValue(new Error('Network timeout'))
    const first = renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByRole('button', { name: 'Retry same request' })
    const originalKey = window.sessionStorage.key(0)
    first.unmount()
    auth.user = { id: '507f1f77bcf86cd799439098', role: 'admin' }
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    expect(screen.queryByRole('button', { name: 'Retry same request' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Title' }).value).toBe('')
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(false)
    expect(window.sessionStorage.getItem(originalKey)).not.toBeNull()
    expect(createGeneralPracticeSetDraft).toHaveBeenCalledTimes(1)
  })

  it('blocks creation when secure UUID generation or session storage is unavailable', async () => {
    const user = userEvent.setup()
    globalThis.crypto.randomUUID.mockReturnValueOnce(undefined)
    const first = renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    await fillNewDraft(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Secure request ID/)
    expect(createGeneralPracticeSetDraft).not.toHaveBeenCalled()
    first.unmount()
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: {
      getItem: () => null, setItem: () => { throw new Error('Storage blocked') }, removeItem: () => {},
    } })
    try {
      renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
      await screen.findByText(/Quiz Set:/)
      await fillNewDraft(user)
      await user.click(screen.getByRole('button', { name: 'Save draft' }))
      expect((await screen.findByRole('alert')).textContent).toMatch(/session storage is unavailable/)
      expect(createGeneralPracticeSetDraft).not.toHaveBeenCalled()
    } finally { Object.defineProperty(window, 'sessionStorage', storageDescriptor) }
  })

  it('blocks corrupt recovery and isolates records by Admin and Set', async () => {
    const user = userEvent.setup()
    const otherSetId = '507f1f77bcf86cd799439018'
    window.sessionStorage.setItem(`general-practice-creation:v1:${auth.user.id}:${setId}`, '{broken')
    const first = renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(true)
    first.unmount()
    fetchGeneralPracticeSet.mockResolvedValue({ set: { ...parentSet, id: otherSetId }, quizzes: [] })
    const second = renderEditor(`/general-practice/sets/${otherSetId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(false)
    second.unmount()
    auth.user = { id: '507f1f77bcf86cd799439098', role: 'admin' }
    fetchGeneralPracticeSet.mockResolvedValue({ set: parentSet, quizzes: [] })
    renderEditor(`/general-practice/sets/${setId}/quizzes/new`)
    await screen.findByText(/Quiz Set:/)
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(false)
    expect(createGeneralPracticeSetDraft).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByRole('alert').textContent).toMatch(/Enter a quiz title/)
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
