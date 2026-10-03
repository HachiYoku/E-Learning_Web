import { afterEach, describe, expect, it } from 'vitest'
import {
  ADMIN_RETURN_DESTINATION_KEY,
  clearAdminReturnDestination,
  internalDestination,
  readAdminReturnDestination,
  saveAdminReturnDestination,
} from './adminReturnDestination'

afterEach(() => window.sessionStorage.clear())

describe('Admin return destinations', () => {
  it('preserves an internal pathname, query string, and hash', () => {
    const location = { pathname: '/review-payment', search: '?payment=payment-123', hash: '#proof' }
    expect(internalDestination(location)).toBe('/review-payment?payment=payment-123#proof')

    saveAdminReturnDestination(location)
    expect(readAdminReturnDestination()).toBe('/review-payment?payment=payment-123#proof')
    clearAdminReturnDestination()
    expect(window.sessionStorage.getItem(ADMIN_RETURN_DESTINATION_KEY)).toBeNull()
  })

  it('rejects login and external destinations', () => {
    expect(internalDestination({ pathname: '/login', search: '?next=/review-payment' })).toBe('/')
    expect(internalDestination({ pathname: '/login/retry' })).toBe('/')
    expect(internalDestination({ pathname: 'https://outside.example/review-payment' })).toBe('/')
    expect(internalDestination({ pathname: '//outside.example/review-payment' })).toBe('/')

    window.sessionStorage.setItem(ADMIN_RETURN_DESTINATION_KEY, 'https://outside.example/review-payment')
    expect(readAdminReturnDestination()).toBe('/')
  })
})
