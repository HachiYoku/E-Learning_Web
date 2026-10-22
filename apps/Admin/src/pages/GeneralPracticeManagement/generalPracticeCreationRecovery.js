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
    if (operation?.version !== 1 || operation.adminId !== key.split(':')[2]
      || operation.setId !== key.split(':')[3] || !uuidV4.test(operation.creationRequestId || '')
      || !['pending', 'uncertain', 'conflict'].includes(operation.status)
      || !operation.draft || typeof operation.draft !== 'object' || Array.isArray(operation.draft)
      || !Array.isArray(operation.draft.questions) || validateDraft(operation.draft).length) {
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
    storage.setItem(key, JSON.stringify(operation))
    return true
  } catch { return false }
}

export function clearCreation(storage, key) {
  try {
    storage.removeItem(key)
    return true
  } catch { return false }
}
