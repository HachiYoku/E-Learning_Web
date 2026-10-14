import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
import { apiClient } from '../api/client'
import { archiveGeneralPracticeQuiz, createGeneralPracticeDraft, disableGeneralPracticeQuiz, enableGeneralPracticeQuiz, fetchGeneralPracticeQuiz, fetchGeneralPracticeQuizzes, fetchGeneralPracticeSet, fetchGeneralPracticeSets, isSafeQuizSetCoverImage, publishGeneralPracticeDraft, retryGeneralPracticeMedia, updateGeneralPracticeDraft } from './generalPracticeAdminService'

const set = { id: 'set-1', name: 'Thai basics', status: 'active', version: 2, displayOrder: 1,
  description: '', coverImage: '', difficulty: null }
const setQuiz = { id: 'quiz-1', title: 'Greetings', status: 'draft', sortOrder: 1,
  standaloneAccess: null }

beforeEach(() => vi.resetAllMocks())

it('only renders authorized Cloudinary HTTPS Set cover images', () => {
  expect(isSafeQuizSetCoverImage('https://res.cloudinary.com/arun/image/upload/v1/set.jpg')).toBe(true)
  expect(isSafeQuizSetCoverImage('https://unrelated.example/image/upload/set.jpg')).toBe(false)
  expect(isSafeQuizSetCoverImage('http://res.cloudinary.com/arun/image/upload/set.jpg')).toBe(false)
})

it('reads and validates Admin Quiz Set list and details responses', async () => {
  apiClient.get.mockResolvedValueOnce({ sets: [set] }).mockResolvedValueOnce({ set, quizzes: [setQuiz] })
  expect(await fetchGeneralPracticeSets()).toEqual([set])
  expect(await fetchGeneralPracticeSet('set-1')).toEqual({ set, quizzes: [setQuiz] })
  expect(apiClient.get.mock.calls).toEqual([
    ['/quizzes/admin/standalone/sets'],
    ['/quizzes/admin/standalone/sets/set-1'],
  ])
})

it('rejects malformed Set list and details instead of rendering misleading content', async () => {
  apiClient.get.mockResolvedValueOnce({ sets: [{ ...set, status: 'published' }] })
    .mockResolvedValueOnce({ set, quizzes: [{ ...setQuiz, sortOrder: '1' }] })
  await expect(fetchGeneralPracticeSets()).rejects.toThrow(/Unable to load/)
  await expect(fetchGeneralPracticeSet('set-1')).rejects.toThrow(/Unable to load/)
})

it('shares only simultaneous identical Set reads and permits a later refresh', async () => {
  let complete
  apiClient.get.mockReturnValueOnce(new Promise((resolve) => { complete = resolve }))
    .mockResolvedValueOnce({ sets: [] })
  const first = fetchGeneralPracticeSets()
  const second = fetchGeneralPracticeSets()
  expect(first).toBe(second)
  await Promise.resolve()
  expect(apiClient.get).toHaveBeenCalledTimes(1)
  complete({ sets: [set] })
  expect(await first).toEqual([set])
  expect(await fetchGeneralPracticeSets()).toEqual([])
  expect(apiClient.get).toHaveBeenCalledTimes(2)
})

it.each([401, 403, 404, 503])('preserves HTTP %s Set-read failures for the UI', async (status) => {
  apiClient.get.mockRejectedValue(Object.assign(new Error('Request failed'), { status }))
  await expect(fetchGeneralPracticeSet('set-1')).rejects.toMatchObject({ status })
})

it('surfaces Set-list network failures without retrying a request automatically', async () => {
  apiClient.get.mockRejectedValue(new Error('Network unavailable'))
  await expect(fetchGeneralPracticeSets()).rejects.toThrow('Network unavailable')
  expect(apiClient.get).toHaveBeenCalledTimes(1)
})

it('reads the dedicated Admin list response, not the public discovery endpoint', async () => {
  const quizzes = [{ id: 'quiz-1', contextType: 'standalone', draft: { title: 'Draft' } }]
  apiClient.get.mockResolvedValue({ quizzes })
  expect(await fetchGeneralPracticeQuizzes()).toEqual(quizzes)
  expect(apiClient.get).toHaveBeenCalledWith('/quizzes/admin/standalone')
})

it('rejects an unexpected list response', async () => {
  apiClient.get.mockResolvedValue({ quizzes: null })
  await expect(fetchGeneralPracticeQuizzes()).rejects.toThrow('Unable to load')
})

it('reads one Admin projection without using the generic Course Quiz service', async () => {
  const quiz = { id: 'quiz-1', contextType: 'standalone', published: { revision: 1 } }
  apiClient.get.mockResolvedValue(quiz)
  expect(await fetchGeneralPracticeQuiz('quiz-1')).toEqual(quiz)
  expect(apiClient.get).toHaveBeenCalledWith('/quizzes/admin/standalone/quiz-1')
})

it('blocks the obsolete create contract while preserving versioned draft updates', async () => {
  const draft = { title: 'Thai', questions: [] }
  apiClient.put.mockResolvedValue({ id: 'quiz-1', draft: { version: 3 } })
  await expect(createGeneralPracticeDraft(draft)).rejects.toThrow(/requires a Quiz Set/)
  await updateGeneralPracticeDraft('quiz-1', 2, draft)
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(apiClient.put).toHaveBeenCalledWith('/quizzes/admin/standalone/quiz-1/draft', { expectedVersion: 2, draft })
})

it('uses the dedicated publish, lifecycle and media-retry endpoints', async () => {
  await publishGeneralPracticeDraft('quiz-1', 4)
  await disableGeneralPracticeQuiz('quiz-1')
  await enableGeneralPracticeQuiz('quiz-1')
  await archiveGeneralPracticeQuiz('quiz-1')
  await retryGeneralPracticeMedia('quiz-1')
  expect(apiClient.post.mock.calls).toEqual([
    ['/quizzes/admin/standalone/quiz-1/publish', { expectedVersion: 4 }],
    ['/quizzes/admin/standalone/quiz-1/disable'],
    ['/quizzes/admin/standalone/quiz-1/enable'],
    ['/quizzes/admin/standalone/quiz-1/archive'],
    ['/quizzes/admin/standalone/quiz-1/media/retry'],
  ])
})
