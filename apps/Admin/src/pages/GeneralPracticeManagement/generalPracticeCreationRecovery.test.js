import { describe, expect, it } from 'vitest'
import { creationStorageKey, readCreation, writeCreation } from './generalPracticeCreationRecovery'

const adminId = '507f1f77bcf86cd799439099'
const setId = '507f1f77bcf86cd799439011'
const key = creationStorageKey(adminId, setId)

describe('Quiz creation recovery record validation', () => {
  it('requires stable Admin and Set identifiers', () => {
    expect(creationStorageKey('bad', setId)).toBeNull()
    expect(creationStorageKey(adminId, 'bad')).toBeNull()
    expect(creationStorageKey(adminId.toUpperCase(), setId.toUpperCase())).toBe(key)
  })

  it('distinguishes unavailable storage from corrupt records', () => {
    expect(readCreation(null, key).state).toBe('unavailable')
    expect(readCreation({ getItem: () => { throw new Error('blocked') } }, key).state).toBe('unavailable')
    expect(readCreation({ getItem: () => '{broken' }, key).state).toBe('corrupt')
    expect(readCreation({ getItem: () => JSON.stringify({ version: 1, adminId, setId,
      creationRequestId: 'bad', status: 'pending', draft: {} }) }, key).state).toBe('corrupt')
  })

  it('rejects records owned by a different Admin or Set', () => {
    const operation = { version: 1, adminId: '507f1f77bcf86cd799439098', setId,
      creationRequestId: '550e8400-e29b-41d4-a716-446655440000', status: 'uncertain', draft: {} }
    expect(readCreation({ getItem: () => JSON.stringify(operation) }, key).state).toBe('corrupt')
  })

  it('stores only identifiers for a pending media request', () => {
    let saved
    const storage = { setItem: (_key, value) => { saved = value }, getItem: () => saved }
    const operation = { version: 2, adminId, setId,
      creationRequestId: '550e8400-e29b-41d4-a716-446655440000', status: 'uncertain',
      draft: { title: 'Not persisted' }, files: [{ field: 'questionImage_0', file: { name: 'prompt.png' } }] }
    expect(writeCreation(storage, key, operation)).toBe(true)
    expect(JSON.parse(saved)).toEqual({ version: 2, adminId, setId,
      creationRequestId: operation.creationRequestId, status: 'uncertain' })
    expect(readCreation(storage, key).state).toBe('recovered')
  })

  it('persists only a verified failed-media status and cleanup classification', () => {
    let saved
    const storage = { setItem: (_key, value) => { saved = value }, getItem: () => saved }
    const operation = { version: 2, adminId, setId,
      creationRequestId: '550e8400-e29b-41d4-a716-446655440000', status: 'failed',
      mediaCleanup: 'retry_required', draft: { title: 'Not persisted' }, files: [{ file: { name: 'prompt.png' } }] }
    expect(writeCreation(storage, key, operation)).toBe(true)
    expect(JSON.parse(saved)).toEqual({ version: 2, adminId, setId,
      creationRequestId: operation.creationRequestId, status: 'failed', mediaCleanup: 'retry_required' })
    expect(readCreation(storage, key).state).toBe('recovered')
    expect(readCreation({ getItem: () => JSON.stringify({ ...JSON.parse(saved), mediaCleanup: undefined }) }, key).state).toBe('corrupt')
  })
})
