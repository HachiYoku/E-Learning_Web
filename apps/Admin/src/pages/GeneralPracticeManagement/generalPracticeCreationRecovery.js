import { validateDraft } from './generalPracticeDraft'

const objectId = /^[0-9a-f]{24}$/i
export const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function creationStorageKey(adminId, setId) {
  if (!objectId.test(adminId || '') || !objectId.test(setId || '')) return null
  return `general-practice-creation:v1:${adminId.toLowerCase()}:${setId.toLowerCase()}`
}

export function readCreation(storage, key) {
  if (!key) return { state: 'unavailable' }
  let raw
  try { raw = storage.getItem(key) } catch { return { state: 'unavailable' } }
  if (raw === null) return { state: 'empty' }
  try {
    const operation = JSON.parse(raw)
    if (![1, 2].includes(operation?.version) || operation.adminId !== key.split(':')[2]
      || operation.setId !== key.split(':')[3] || !uuidV4.test(operation.creationRequestId || '')
      || !['pending', 'uncertain', 'conflict', ...(operation.version === 2 ? ['failed'] : [])].includes(operation.status)
      || (operation.version === 2 && operation.status === 'failed'
        && !['complete', 'unverified', 'retry_required'].includes(operation.mediaCleanup))
      || (operation.version === 2 && operation.mediaCleanup !== undefined
        && !['complete', 'unverified', 'retry_required'].includes(operation.mediaCleanup))
      || (operation.version === 1 && (!operation.draft || typeof operation.draft !== 'object'
        || Array.isArray(operation.draft) || !Array.isArray(operation.draft.questions)
        || validateDraft(operation.draft).length))) {
      return { state: 'corrupt' }
    }
    return { state: 'recovered', operation }
  } catch { return { state: 'corrupt' } }
}

export function browserCreationStorage() {
  try { return window.sessionStorage } catch { return null }
}

export function writeCreation(storage, key, operation) {
  try {
    const stored = operation.version === 2
      ? { version: 2, adminId: operation.adminId, setId: operation.setId,
        creationRequestId: operation.creationRequestId, status: operation.status,
        ...(['complete', 'unverified', 'retry_required'].includes(operation.mediaCleanup)
          ? { mediaCleanup: operation.mediaCleanup } : {}) }
      : operation
    storage.setItem(key, JSON.stringify(stored))
    return true
  } catch { return false }
}

export function clearCreation(storage, key) {
  try {
    storage.removeItem(key)
    return true
  } catch { return false }
}
