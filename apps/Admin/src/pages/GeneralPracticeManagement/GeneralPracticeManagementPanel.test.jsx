import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeneralPracticeManagementPanel from './GeneralPracticeManagementPanel'

vi.mock('../../services/generalPracticeAdminService', () => ({
  fetchGeneralPracticeQuiz: vi.fn(), publishGeneralPracticeDraft: vi.fn(), disableGeneralPracticeQuiz: vi.fn(),
  enableGeneralPracticeQuiz: vi.fn(), archiveGeneralPracticeQuiz: vi.fn(), restoreGeneralPracticeQuiz: vi.fn(), retryGeneralPracticeMedia: vi.fn(),
}))
import { archiveGeneralPracticeQuiz, disableGeneralPracticeQuiz, enableGeneralPracticeQuiz, fetchGeneralPracticeQuiz, publishGeneralPracticeDraft, restoreGeneralPracticeQuiz, retryGeneralPracticeMedia } from '../../services/generalPracticeAdminService'

const base = { id: 'quiz-1', contextType: 'standalone', status: 'published', mediaProcessing: 'complete', published: { revision: 1 }, draft: { version: 2 } }
function Harness({ initial = base }) {
  const [quiz, setQuiz] = useState(initial)
  return <GeneralPracticeManagementPanel quiz={quiz} onQuizChange={setQuiz} />
}

async function confirm(user, action, confirmLabel) {
  await user.click(screen.getByRole('button', { name: action }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: confirmLabel }))
}

describe('General Practice management actions', () => {
  beforeEach(() => vi.resetAllMocks())

  it('publishes only after confirmation with the current draft version and reloads', async () => {
    const user = userEvent.setup()
    const published = { ...base, published: { revision: 2 }, draft: null }
    publishGeneralPracticeDraft.mockResolvedValue(published)
    fetchGeneralPracticeQuiz.mockResolvedValue(published)
    render(<Harness />)
    expect(screen.getByText(/Unpublished changes: Yes/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Publish draft' }))
    expect(publishGeneralPracticeDraft).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(publishGeneralPracticeDraft).not.toHaveBeenCalled()
    await confirm(user, 'Publish draft', 'Publish draft')
    await waitFor(() => expect(publishGeneralPracticeDraft).toHaveBeenCalledWith('quiz-1', 2))
    await waitFor(() => expect(fetchGeneralPracticeQuiz).toHaveBeenCalledWith('quiz-1'))
    expect(screen.getByText(/Unpublished changes: No/)).toBeTruthy()
    expect(screen.getByText('Quiz Update Published')).toBeTruthy()
    expect(screen.getByText(/Students who started this quiz before the update/)).toBeTruthy()
  })

  it('does not describe an initial publication as an update to existing sessions', async () => {
    const user = userEvent.setup()
    const draft = { ...base, status: 'draft', published: null, draft: { version: 1 } }
    const published = { ...draft, status: 'published', published: { revision: 1 }, draft: null }
    publishGeneralPracticeDraft.mockResolvedValue(published)
    fetchGeneralPracticeQuiz.mockResolvedValue(published)
    render(<Harness initial={draft} />)
    await confirm(user, 'Publish draft', 'Publish draft')
    await waitFor(() => expect(fetchGeneralPracticeQuiz).toHaveBeenCalledWith('quiz-1'))
    expect(screen.queryByText('Quiz Update Published')).toBeNull()
  })

  it('disables a published quiz and requires confirmation before archiving', async () => {
    const user = userEvent.setup()
    const disabled = { ...base, status: 'disabled' }
    disableGeneralPracticeQuiz.mockResolvedValue(disabled)
    fetchGeneralPracticeQuiz.mockResolvedValue(disabled)
    render(<Harness />)
    await confirm(user, 'Disable quiz', 'Disable quiz')
    await waitFor(() => expect(disableGeneralPracticeQuiz).toHaveBeenCalledWith('quiz-1'))
    expect(screen.getByRole('button', { name: 'Enable quiz' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Archive quiz' }))
    expect(within(screen.getByRole('dialog')).getByText(/Saved attempts remain available/)).toBeTruthy()
    expect(archiveGeneralPracticeQuiz).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(archiveGeneralPracticeQuiz).not.toHaveBeenCalled()
  })

  it('enables without publishing its pending draft', async () => {
    const user = userEvent.setup()
    const disabled = { ...base, status: 'disabled' }
    const enabled = { ...base, status: 'published' }
    enableGeneralPracticeQuiz.mockResolvedValue(enabled)
    fetchGeneralPracticeQuiz.mockResolvedValue(enabled)
    render(<Harness initial={disabled} />)
    expect(screen.queryByRole('button', { name: 'Publish draft' })).toBeNull()
    await confirm(user, 'Enable quiz', 'Enable quiz')
    await waitFor(() => expect(enableGeneralPracticeQuiz).toHaveBeenCalledWith('quiz-1'))
    expect(publishGeneralPracticeDraft).not.toHaveBeenCalled()
    expect(screen.getByText(/Unpublished changes: Yes/)).toBeTruthy()
  })

  it('archives only after confirmation and then offers Restore', async () => {
    const user = userEvent.setup()
    const archived = { ...base, status: 'archived' }
    archiveGeneralPracticeQuiz.mockResolvedValue(archived)
    fetchGeneralPracticeQuiz.mockResolvedValue(archived)
    render(<Harness />)
    await confirm(user, 'Archive quiz', 'Archive quiz')
    await waitFor(() => expect(archiveGeneralPracticeQuiz).toHaveBeenCalledWith('quiz-1'))
    expect(screen.queryByRole('button', { name: 'Archive quiz' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Restore quiz' })).toBeTruthy()
  })

  it('restores only after confirmation, reloads Draft, and never publishes automatically', async () => {
    const user = userEvent.setup()
    const archived = { ...base, status: 'archived' }
    const restored = { ...archived, status: 'draft' }
    restoreGeneralPracticeQuiz.mockResolvedValue(restored)
    fetchGeneralPracticeQuiz.mockResolvedValue(restored)
    render(<Harness initial={archived} />)
    await user.click(screen.getByRole('button', { name: 'Restore quiz' }))
    expect(within(screen.getByRole('dialog')).getByText(/remain unavailable to students until you explicitly publish/)).toBeTruthy()
    expect(restoreGeneralPracticeQuiz).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(restoreGeneralPracticeQuiz).not.toHaveBeenCalled()
    await confirm(user, 'Restore quiz', 'Restore quiz')
    await waitFor(() => expect(restoreGeneralPracticeQuiz).toHaveBeenCalledWith('quiz-1'))
    await waitFor(() => expect(fetchGeneralPracticeQuiz).toHaveBeenCalledWith('quiz-1'))
    expect(screen.getByRole('button', { name: 'Publish draft' })).toBeTruthy()
    expect(publishGeneralPracticeDraft).not.toHaveBeenCalled()
  })

  it('blocks duplicate Restore requests and requires reload after a conflict', async () => {
    const user = userEvent.setup()
    const archived = { ...base, status: 'archived' }
    let rejectRestore
    restoreGeneralPracticeQuiz.mockReturnValue(new Promise((_resolve, reject) => { rejectRestore = reject }))
    fetchGeneralPracticeQuiz.mockResolvedValue(archived)
    render(<Harness initial={archived} />)
    await confirm(user, 'Restore quiz', 'Restore quiz')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Processing…' }).disabled).toBe(true)
    expect(restoreGeneralPracticeQuiz).toHaveBeenCalledTimes(1)
    rejectRestore(Object.assign(new Error('Changed'), { status: 409 }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed or this action is no longer allowed/)
    expect(screen.getByRole('button', { name: 'Restore quiz' }).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Reload current quiz' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore quiz' }).disabled).toBe(false))
    expect(restoreGeneralPracticeQuiz).toHaveBeenCalledTimes(1)
  })

  it('uses only the media-retry endpoint for a pending media operation', async () => {
    const user = userEvent.setup()
    const pending = { ...base, mediaProcessing: 'retry_required' }
    retryGeneralPracticeMedia.mockResolvedValue({ ...pending, mediaProcessing: 'complete' })
    fetchGeneralPracticeQuiz.mockResolvedValue({ ...pending, mediaProcessing: 'complete' })
    render(<Harness initial={pending} />)
    expect(screen.getByRole('button', { name: 'Publish draft' }).disabled).toBe(true)
    await confirm(user, 'Retry media processing', 'Retry media processing')
    await waitFor(() => expect(retryGeneralPracticeMedia).toHaveBeenCalledWith('quiz-1'))
    expect(publishGeneralPracticeDraft).not.toHaveBeenCalled()
    expect(screen.getByText(/Media processing: Complete/)).toBeTruthy()
  })

  it('keeps media retry visible when reconciliation remains pending', async () => {
    const user = userEvent.setup()
    const pending = { ...base, mediaProcessing: 'retry_required' }
    retryGeneralPracticeMedia.mockResolvedValue(pending)
    fetchGeneralPracticeQuiz.mockResolvedValue(pending)
    render(<Harness initial={pending} />)
    await confirm(user, 'Retry media processing', 'Retry media processing')
    expect(await screen.findByText(/still requires retry/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry media processing' })).toBeTruthy()
    expect(publishGeneralPracticeDraft).not.toHaveBeenCalled()
  })

  it('blocks repeated publication while the first request is pending', async () => {
    const user = userEvent.setup()
    let resolvePublish
    publishGeneralPracticeDraft.mockReturnValue(new Promise((resolve) => { resolvePublish = resolve }))
    const published = { ...base, published: { revision: 2 }, draft: null }
    fetchGeneralPracticeQuiz.mockResolvedValue(published)
    render(<Harness />)
    await confirm(user, 'Publish draft', 'Publish draft')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Processing…' }).disabled).toBe(true)
    expect(publishGeneralPracticeDraft).toHaveBeenCalledTimes(1)
    resolvePublish(published)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('requires reload after a 409 conflict and never silently retries', async () => {
    const user = userEvent.setup()
    publishGeneralPracticeDraft.mockRejectedValue(Object.assign(new Error('Changed'), { status: 409 }))
    fetchGeneralPracticeQuiz.mockResolvedValue({ ...base, draft: { version: 3 } })
    render(<Harness />)
    await confirm(user, 'Publish draft', 'Publish draft')
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed or this action is no longer allowed/)
    expect(screen.queryByText('Quiz Update Published')).toBeNull()
    expect(screen.getByRole('button', { name: 'Publish draft' }).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Reload current quiz' }))
    await waitFor(() => expect(screen.getByText(/Pending draft version: 3/)).toBeTruthy())
    expect(publishGeneralPracticeDraft).toHaveBeenCalledTimes(1)
  })

  it('reports uncertain network and authorization errors without claiming success', async () => {
    const user = userEvent.setup()
    disableGeneralPracticeQuiz.mockRejectedValueOnce(new Error('Network')).mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
    fetchGeneralPracticeQuiz.mockResolvedValue(base)
    render(<Harness />)
    await confirm(user, 'Disable quiz', 'Disable quiz')
    expect((await screen.findByRole('alert')).textContent).toMatch(/outcome is uncertain/)
    expect(screen.getByRole('button', { name: 'Disable quiz' }).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Reload current quiz' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Disable quiz' }).disabled).toBe(false))
    await confirm(user, 'Disable quiz', 'Disable quiz')
    expect((await screen.findByRole('alert')).textContent).toMatch(/Admin access is required/)
    expect(screen.queryByText(/confirmed by the server/)).toBeNull()
  })

  it('surfaces an invalid-state response without reporting success', async () => {
    const user = userEvent.setup()
    archiveGeneralPracticeQuiz.mockRejectedValue(Object.assign(new Error('Invalid action'), { status: 400 }))
    render(<Harness />)
    await confirm(user, 'Archive quiz', 'Archive quiz')
    expect((await screen.findByRole('alert')).textContent).toMatch(/Invalid action/)
    expect(screen.queryByText(/confirmed by the server/)).toBeNull()
  })
})
