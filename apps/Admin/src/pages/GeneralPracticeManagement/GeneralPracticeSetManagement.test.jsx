import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeneralPracticeSetCreate from './GeneralPracticeSetCreate'
import GeneralPracticeSetDetails from './GeneralPracticeSetDetails'
import { validateSetForm } from './quizSetFormFields'

vi.mock('../../services/generalPracticeAdminService', () => ({
  createGeneralPracticeSet: vi.fn(), updateGeneralPracticeSet: vi.fn(), transitionGeneralPracticeSet: vi.fn(),
  deleteGeneralPracticeSet: vi.fn(), fetchGeneralPracticeSet: vi.fn(), isSafeQuizSetCoverImage: vi.fn(() => false),
  uploadGeneralPracticeSetCover: vi.fn(), removeGeneralPracticeSetCover: vi.fn(),
}))
import { createGeneralPracticeSet, updateGeneralPracticeSet, transitionGeneralPracticeSet, deleteGeneralPracticeSet, fetchGeneralPracticeSet, uploadGeneralPracticeSetCover, removeGeneralPracticeSetCover } from '../../services/generalPracticeAdminService'

const id = '507f1f77bcf86cd799439011'
const disabled = { id, name: 'Thai basics', description: '', coverImage: '', difficulty: null, displayOrder: 1, status: 'disabled', version: 1 }
const active = { ...disabled, status: 'active', version: 2 }

function CurrentPath() { const location = useLocation(); return <p data-testid="path">{location.pathname}</p> }
function pages(path) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/general-practice/sets/new" element={<GeneralPracticeSetCreate />} />
    <Route path="/general-practice/sets/:setId" element={<GeneralPracticeSetDetails />} />
    <Route path="/general-practice" element={<CurrentPath />} />
  </Routes></MemoryRouter>)
}
async function confirm(user, label) {
  await user.click(screen.getByRole('button', { name: label }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }))
}

describe('Quiz Set management', () => {
  beforeEach(() => { vi.resetAllMocks(); fetchGeneralPracticeSet.mockResolvedValue({ set: disabled, quizzes: [] }) })

  it('validates required fields and rejects invalid cover files before creation', async () => {
    const user = userEvent.setup()
    pages('/general-practice/sets/new')
    expect(screen.getByText('Thai Practice')).toBeTruthy()
    expect(screen.getByText('Thai Practice').parentElement.parentElement.parentElement.className).toContain('max-w-md')
    await user.click(screen.getByRole('button', { name: 'Create Quiz Set' }))
    expect(screen.getByText('Enter a Quiz Set name.')).toBeTruthy()
    expect(createGeneralPracticeSet).not.toHaveBeenCalled()
    const oversized = new File(['jpeg'], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 })
    await user.upload(screen.getByLabelText(/Cover image \(optional\)/), oversized)
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Thai basics')
    await user.click(screen.getByRole('button', { name: 'Create Quiz Set' }))
    expect(screen.getByText(/Choose a JPG, PNG, or WebP image no larger than 5 MiB/)).toBeTruthy()
    expect(createGeneralPracticeSet).not.toHaveBeenCalled()
    expect(validateSetForm({ name: 'Thai', description: '', difficulty: '', coverImage: '' })).toEqual({})
  })

  it('creates a Disabled Set once and navigates only after a verified response', async () => {
    const user = userEvent.setup()
    let resolveCreate
    createGeneralPracticeSet.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    pages('/general-practice/sets/new')
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Thai basics')
    await user.click(screen.getByRole('button', { name: 'Create Quiz Set' }))
    expect(createGeneralPracticeSet).toHaveBeenCalledWith({ name: 'Thai basics', description: '', difficulty: null, coverImage: '' })
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true)
    expect(createGeneralPracticeSet).toHaveBeenCalledTimes(1)
    resolveCreate(disabled)
    expect(await screen.findByRole('heading', { name: 'Thai basics' })).toBeTruthy()
    expect(screen.getByText('Set: disabled')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('creates a Set before uploading its selected cover and never creates twice after upload failure', async () => {
    const user = userEvent.setup()
    const file = new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' })
    createGeneralPracticeSet.mockResolvedValue(disabled)
    uploadGeneralPracticeSetCover.mockRejectedValue(new Error('Upload unavailable'))
    pages('/general-practice/sets/new')
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Thai basics')
    await user.upload(screen.getByLabelText(/Cover image \(optional\)/), file)
    await user.click(screen.getByRole('button', { name: 'Create Quiz Set' }))
    expect(await screen.findByText(/Cover upload could not be confirmed/)).toBeTruthy()
    expect(createGeneralPracticeSet).toHaveBeenCalledTimes(1)
    expect(uploadGeneralPracticeSetCover).toHaveBeenCalledWith(id, 1, file)
  })

  it('protects a selected image when leaving an unsaved form', async () => {
    const user = userEvent.setup()
    pages('/general-practice/sets/new')
    await user.upload(screen.getByLabelText(/Cover image \(optional\)/), new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Continue editing' }))
    expect(screen.queryByTestId('path')).toBeNull()
  })

  it('shows a local cover preview and revokes its object URL on unmount', async () => {
    const previousCreate = URL.createObjectURL
    const previousRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:cover-preview')
    URL.revokeObjectURL = vi.fn()
    try {
      const user = userEvent.setup()
      const view = pages('/general-practice/sets/new')
      await user.upload(screen.getByLabelText(/Cover image \(optional\)/), new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' }))
      expect((await screen.findByAltText('Quiz Set cover preview')).getAttribute('src')).toBe('blob:cover-preview')
      view.unmount()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover-preview')
    } finally {
      URL.createObjectURL = previousCreate
      URL.revokeObjectURL = previousRevoke
    }
  })

  it.each([[400, /Invalid metadata/], [401, /Admin access/], [403, /Admin access/], [503, /couldn't confirm whether your Quiz Set was created/], [undefined, /couldn't confirm whether your Quiz Set was created/]])('handles creation failure %s without claiming success', async (status, message) => {
    const user = userEvent.setup()
    createGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Invalid metadata'), { status }))
    pages('/general-practice/sets/new')
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Thai basics')
    await user.click(screen.getByRole('button', { name: 'Create Quiz Set' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(message)
    expect(screen.getByRole('textbox', { name: /Name/ }).value).toBe('Thai basics')
  })

  it('locks an uncertain create and directs the Admin to the catalog without retrying', async () => {
    const user = userEvent.setup()
    createGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Unavailable'), { status: 503 }))
    pages('/general-practice/sets/new')
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Thai basics')
    await user.click(screen.getByRole('button', { name: 'Create Quiz Set' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/check the Quiz Set list before trying again/)
    expect(screen.getByRole('button', { name: 'Create Quiz Set' }).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Check Quiz Set list' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByTestId('path').textContent).toBe('/general-practice')
    expect(createGeneralPracticeSet).toHaveBeenCalledTimes(1)
  })

  it('keeps dirty create values when the Admin chooses Continue editing, then allows confirmed discard', async () => {
    const user = userEvent.setup()
    pages('/general-practice/sets/new')
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Thai basics')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Continue editing' })).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Continue editing' }))
    expect(screen.getByRole('textbox', { name: /Name/ }).value).toBe('Thai basics')
    expect(screen.queryByTestId('path')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByTestId('path').textContent).toBe('/general-practice')
    expect(createGeneralPracticeSet).not.toHaveBeenCalled()
  })

  it('closes an unchanged create form without a discard warning', async () => {
    const user = userEvent.setup()
    pages('/general-practice/sets/new')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('path').textContent).toBe('/general-practice')
  })

  it('updates only metadata with expectedVersion and displays the returned Set', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeSet.mockResolvedValue({ ...disabled, name: 'Thai essentials', version: 2 })
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    const name = screen.getByRole('textbox', { name: /Name/ })
    await user.clear(name)
    await user.type(name, 'Thai essentials')
    await user.click(screen.getByRole('button', { name: 'Save Set changes' }))
    await waitFor(() => expect(updateGeneralPracticeSet).toHaveBeenCalledWith(id, 1, { name: 'Thai essentials', description: '', difficulty: null, coverImage: '' }))
    expect(await screen.findByRole('heading', { name: 'Thai essentials' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('replaces or removes a cover only after the versioned metadata save', async () => {
    const user = userEvent.setup()
    const file = new File(['jpeg'], 'new.jpg', { type: 'image/jpeg' })
    const withCover = { ...disabled, coverImage: 'https://res.cloudinary.com/test/image/upload/old.jpg' }
    fetchGeneralPracticeSet.mockResolvedValue({ set: withCover, quizzes: [] })
    updateGeneralPracticeSet.mockResolvedValueOnce({ ...withCover, version: 2 }).mockResolvedValueOnce({ ...withCover, version: 4 })
    uploadGeneralPracticeSetCover.mockResolvedValue({ set: { ...withCover, version: 3, coverImage: 'https://res.cloudinary.com/test/image/upload/new.jpg' }, mediaCleanup: 'complete' })
    removeGeneralPracticeSetCover.mockResolvedValue({ set: { ...withCover, version: 5, coverImage: '' }, mediaCleanup: 'complete' })
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    await user.upload(screen.getByLabelText(/Cover image \(optional\)/), file)
    await user.click(screen.getByRole('button', { name: 'Save Set changes' }))
    await waitFor(() => expect(uploadGeneralPracticeSetCover).toHaveBeenCalledWith(id, 2, file))
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    await user.click(screen.getByRole('button', { name: 'Remove cover image' }))
    await user.click(screen.getByRole('button', { name: 'Save Set changes' }))
    await waitFor(() => expect(removeGeneralPracticeSetCover).toHaveBeenCalledWith(id, 4))
  })

  it('does not upload a cover when the Set metadata save conflicts', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Stale'), { status: 409 }))
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    await user.upload(screen.getByLabelText(/Cover image \(optional\)/), new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' }))
    await user.click(screen.getByRole('button', { name: 'Save Set changes' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed elsewhere/)
    expect(uploadGeneralPracticeSetCover).not.toHaveBeenCalled()
  })

  it('keeps a successful replacement saved while warning that old-cover cleanup needs an operator retry', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeSet.mockResolvedValue({ ...disabled, version: 2 })
    uploadGeneralPracticeSetCover.mockResolvedValue({ set: { ...disabled, version: 3,
      coverImage: 'https://res.cloudinary.com/test/image/upload/new.jpg' }, mediaCleanup: 'retry_required' })
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    await user.upload(screen.getByLabelText(/Cover image \(optional\)/), new File(['jpeg'], 'new.jpg', { type: 'image/jpeg' }))
    await user.click(screen.getByRole('button', { name: 'Save Set changes' }))
    expect((await screen.findByRole('status')).textContent).toMatch(/Quiz Set saved.*operator retry/)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(uploadGeneralPracticeSetCover).toHaveBeenCalledTimes(1)
  })

  it('confirms discarding dirty edit values and closes unchanged edits without warning', async () => {
    const user = userEvent.setup()
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    await user.type(screen.getByRole('textbox', { name: /Name/ }), ' changed')
    expect(screen.queryByRole('link', { name: 'Back to Quiz Sets' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Continue editing' }))
    expect(screen.getByRole('textbox', { name: /Name/ }).value).toBe('Thai basics changed')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard changes' }))
    expect(screen.queryByRole('textbox', { name: /Name/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Thai basics' })).toBeTruthy()
    expect(updateGeneralPracticeSet).not.toHaveBeenCalled()
  })

  it('keeps edit-specific guidance after an uncertain update', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Unavailable'), { status: 503 }))
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    await user.type(screen.getByRole('textbox', { name: /Name/ }), ' changed')
    await user.click(screen.getByRole('button', { name: 'Save Set changes' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Reload the latest Set before trying again/)
    expect(screen.getByRole('button', { name: 'Save Set changes' }).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Check Quiz Set list' })).toBeNull()
  })

  it('preserves unsaved edits and requires reload after a stale-version conflict', async () => {
    const user = userEvent.setup()
    updateGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Stale'), { status: 409 }))
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: 'Edit Set details' }))
    await user.type(screen.getByRole('textbox', { name: /Name/ }), ' changed')
    await user.click(screen.getByRole('button', { name: 'Save Set changes' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed elsewhere/)
    expect(screen.getByRole('textbox', { name: /Name/ }).value).toBe('Thai basics changed')
    expect(screen.getByRole('button', { name: 'Save Set changes' }).disabled).toBe(true)
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Reload current Set' }))
    expect(fetchGeneralPracticeSet).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Reload current Set' }))
    await waitFor(() => expect(fetchGeneralPracticeSet).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('textbox', { name: /Name/ }).value).toBe('Thai basics')
  })

  it.each([
    ['activate', disabled, 'Activate Set', 'active'],
    ['disable', active, 'Disable Set', 'disabled'],
    ['archive', disabled, 'Archive Set', 'archived'],
    ['restore', { ...disabled, status: 'archived' }, 'Restore Set', 'disabled'],
  ])('confirms %s with current version and reflects the returned state', async (action, current, label, status) => {
    const user = userEvent.setup()
    fetchGeneralPracticeSet.mockResolvedValue({ set: current, quizzes: [] })
    transitionGeneralPracticeSet.mockResolvedValue({ ...current, status, version: current.version + 1 })
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: label }))
    expect(transitionGeneralPracticeSet).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }))
    await waitFor(() => expect(transitionGeneralPracticeSet).toHaveBeenCalledWith(id, current.version, action))
    expect(screen.getByText(`Set: ${status}`)).toBeTruthy()
  })

  it('prevents duplicate lifecycle requests and locks actions after a conflict', async () => {
    const user = userEvent.setup()
    let rejectAction
    transitionGeneralPracticeSet.mockReturnValue(new Promise((_, reject) => { rejectAction = reject }))
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await user.click(screen.getByRole('button', { name: 'Activate Set' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Activate Set' }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Processing…' }).disabled).toBe(true)
    expect(transitionGeneralPracticeSet).toHaveBeenCalledTimes(1)
    rejectAction(Object.assign(new Error('Stale'), { status: 409 }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed or the action is no longer allowed/)
    expect(screen.getByRole('button', { name: 'Activate Set' }).disabled).toBe(true)
  })

  it.each([[400, /Invalid transition/], [401, /Admin access/], [403, /Admin access/], [503, /outcome is uncertain/], [undefined, /outcome is uncertain/]])('handles lifecycle failure %s without claiming success', async (status, message) => {
    const user = userEvent.setup()
    transitionGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Invalid transition'), { status }))
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await confirm(user, 'Activate Set')
    expect((await screen.findByRole('alert')).textContent).toMatch(message)
    expect(screen.getByText('Set: disabled')).toBeTruthy()
  })

  it('deletes only an empty non-active Set after confirmation', async () => {
    const user = userEvent.setup()
    deleteGeneralPracticeSet.mockResolvedValue({ deleted: true })
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await confirm(user, 'Delete empty Set')
    expect(deleteGeneralPracticeSet).toHaveBeenCalledWith(id, 1)
    expect(await screen.findByTestId('path')).toHaveProperty('textContent', '/general-practice')
  })

  it('blocks deletion controls for active or populated Sets and reports server rejection', async () => {
    const user = userEvent.setup()
    fetchGeneralPracticeSet.mockResolvedValueOnce({ set: active, quizzes: [] })
    const first = pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    expect(screen.queryByRole('button', { name: 'Delete empty Set' })).toBeNull()
    first.unmount()
    fetchGeneralPracticeSet.mockResolvedValueOnce({ set: disabled, quizzes: [{ id: 'quiz-1' }] })
    const second = pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    expect(screen.queryByRole('button', { name: 'Delete empty Set' })).toBeNull()
    second.unmount()
    fetchGeneralPracticeSet.mockResolvedValue({ set: disabled, quizzes: [] })
    deleteGeneralPracticeSet.mockRejectedValue(Object.assign(new Error('Set has members'), { status: 409 }))
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await confirm(user, 'Delete empty Set')
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed or the action is no longer allowed/)
    expect(screen.getByRole('button', { name: 'Delete empty Set' }).disabled).toBe(true)
  })

  it('keeps the Set visible when deletion fails with a network error', async () => {
    const user = userEvent.setup()
    deleteGeneralPracticeSet.mockRejectedValue(new Error('Network unavailable'))
    pages(`/general-practice/sets/${id}`)
    await screen.findByRole('heading', { name: 'Thai basics' })
    await confirm(user, 'Delete empty Set')
    expect((await screen.findByRole('alert')).textContent).toMatch(/outcome is uncertain/)
    expect(screen.getByRole('heading', { name: 'Thai basics' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete empty Set' }).disabled).toBe(true)
  })
})
