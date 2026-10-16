import { apiClient } from '../api/client'

const pendingReads = new Map()

export function isSafeQuizSetCoverImage(url) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com'
      && parsed.pathname.includes('/image/upload/') && !parsed.username && !parsed.password
  } catch { return false }
}

function readOnce(key, request) {
  if (pendingReads.has(key)) return pendingReads.get(key)
  const pending = Promise.resolve().then(request).finally(() => pendingReads.delete(key))
  pendingReads.set(key, pending)
  return pending
}

function validSet(set) {
  return set && typeof set === 'object' && !Array.isArray(set)
    && typeof set.id === 'string' && set.id.length > 0
    && typeof set.name === 'string' && set.name.length > 0
    && ['active', 'disabled', 'archived'].includes(set.status)
    && Number.isSafeInteger(set.version) && set.version >= 1
    && Number.isSafeInteger(set.displayOrder) && set.displayOrder >= 1
    && (set.description === undefined || typeof set.description === 'string')
    && (set.coverImage === undefined || typeof set.coverImage === 'string')
    && (set.difficulty == null || ['Beginner', 'Intermediate', 'Advanced'].includes(set.difficulty))
}

function validSetQuiz(quiz) {
  return quiz && typeof quiz === 'object' && !Array.isArray(quiz)
    && typeof quiz.id === 'string' && quiz.id.length > 0
    && typeof quiz.title === 'string'
    && ['draft', 'published', 'disabled', 'archived'].includes(quiz.status)
    && Number.isSafeInteger(quiz.sortOrder) && quiz.sortOrder >= 1
    && (quiz.standaloneAccess == null || ['public', 'students'].includes(quiz.standaloneAccess))
}

export function fetchGeneralPracticeSets() {
  return readOnce('sets', async () => {
    const response = await apiClient.get('/quizzes/admin/standalone/sets')
    if (!Array.isArray(response?.sets) || response.sets.some((set) => !validSet(set))) {
      throw new Error('Unable to load General Practice Quiz Sets.')
    }
    return response.sets
  })
}

export function fetchGeneralPracticeSet(setId) {
  return readOnce(`set:${setId}`, async () => {
    const response = await apiClient.get(`/quizzes/admin/standalone/sets/${encodeURIComponent(setId)}`)
    if (!validSet(response?.set) || !Array.isArray(response.quizzes)
      || response.quizzes.some((quiz) => !validSetQuiz(quiz))) {
      throw new Error('Unable to load this General Practice Quiz Set.')
    }
    return response
  })
}

function mutationSet(response) {
  if (!validSet(response?.set)) throw new Error('The Quiz Set response could not be verified. Reload before trying again.')
  return response.set
}

export async function createGeneralPracticeSet(fields) {
  return mutationSet(await apiClient.post('/quizzes/admin/standalone/sets', fields))
}

export async function updateGeneralPracticeSet(setId, expectedVersion, fields) {
  return mutationSet(await apiClient.put(`/quizzes/admin/standalone/sets/${encodeURIComponent(setId)}`, { expectedVersion, set: fields }))
}

export async function uploadGeneralPracticeSetCover(setId, expectedVersion, file) {
  const body = new FormData()
  body.append('expectedVersion', String(expectedVersion))
  body.append('cover', file)
  return coverMutation(await apiClient.post(`/quizzes/admin/standalone/sets/${encodeURIComponent(setId)}/cover`, body))
}

export async function removeGeneralPracticeSetCover(setId, expectedVersion) {
  return coverMutation(await apiClient.delete(`/quizzes/admin/standalone/sets/${encodeURIComponent(setId)}/cover`, { expectedVersion }))
}

function coverMutation(response) {
  const set = mutationSet(response)
  if (!['complete', 'retry_required'].includes(response.mediaCleanup)) {
    throw new Error('The cover update response could not be verified. Check the Quiz Set before trying again.')
  }
  return { set, mediaCleanup: response.mediaCleanup }
}

export async function transitionGeneralPracticeSet(setId, expectedVersion, action) {
  if (!['activate', 'disable', 'archive', 'restore'].includes(action)) throw new Error('Unsupported Quiz Set action.')
  return mutationSet(await apiClient.post(`/quizzes/admin/standalone/sets/${encodeURIComponent(setId)}/${action}`, { expectedVersion }))
}

export async function deleteGeneralPracticeSet(setId, expectedVersion) {
  const response = await apiClient.delete(`/quizzes/admin/standalone/sets/${encodeURIComponent(setId)}`, { expectedVersion })
  if (response?.deleted !== true) throw new Error('The deletion response could not be verified. Check the catalog before trying again.')
  if (response.mediaCleanup !== undefined && !['complete', 'retry_required'].includes(response.mediaCleanup)) {
    throw new Error('The cover cleanup result could not be verified. Check the catalog before trying again.')
  }
  return response
}

// Admin projections can contain draft questions and answers. Keep these calls
// separate from the published, student-facing General Practice service.
export async function fetchGeneralPracticeQuizzes() {
  const response = await apiClient.get('/quizzes/admin/standalone')
  if (!Array.isArray(response?.quizzes)) throw new Error('Unable to load General Practice quizzes.')
  return response.quizzes
}

export async function fetchGeneralPracticeQuiz(quizId) {
  const response = await apiClient.get(`/quizzes/admin/standalone/${encodeURIComponent(quizId)}`)
  if (!response?.id || response.contextType !== 'standalone') {
    throw new Error('Unable to load this General Practice quiz.')
  }
  return response
}

export async function createGeneralPracticeDraft(draft) {
  void draft
  throw new Error('Quiz creation requires a Quiz Set. Open a Set and select Create Quiz.')
}

export async function createGeneralPracticeSetDraft(setId, creationRequestId, draft) {
  if (typeof setId !== 'string' || !/^[0-9a-f]{24}$/i.test(setId)) throw new Error('Select a valid Quiz Set before creating a quiz.')
  if (typeof creationRequestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(creationRequestId)) {
    throw new Error('A secure creation request ID is required.')
  }
  return apiClient.post(`/quizzes/admin/standalone/sets/${encodeURIComponent(setId)}/quizzes`, { creationRequestId, draft })
}

export async function updateGeneralPracticeDraft(quizId, expectedVersion, draft) {
  return apiClient.put(`/quizzes/admin/standalone/${encodeURIComponent(quizId)}/draft`, { expectedVersion, draft })
}

export async function publishGeneralPracticeDraft(quizId, expectedVersion) {
  return apiClient.post(`/quizzes/admin/standalone/${encodeURIComponent(quizId)}/publish`, { expectedVersion })
}

export async function disableGeneralPracticeQuiz(quizId) {
  return apiClient.post(`/quizzes/admin/standalone/${encodeURIComponent(quizId)}/disable`)
}

export async function enableGeneralPracticeQuiz(quizId) {
  return apiClient.post(`/quizzes/admin/standalone/${encodeURIComponent(quizId)}/enable`)
}

export async function archiveGeneralPracticeQuiz(quizId) {
  return apiClient.post(`/quizzes/admin/standalone/${encodeURIComponent(quizId)}/archive`)
}

export async function retryGeneralPracticeMedia(quizId) {
  return apiClient.post(`/quizzes/admin/standalone/${encodeURIComponent(quizId)}/media/retry`)
}
