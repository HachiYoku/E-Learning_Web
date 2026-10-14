import { describe, expect, it } from 'vitest'
import { creationStorageKey, readCreation } from './generalPracticeCreationRecovery'

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
})
