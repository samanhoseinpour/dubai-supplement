import { ERROR_CODES } from '@ds/contracts'
import { describe, expect, it } from 'vitest'
import { copy } from './copy'
import { describeError, errorMessage, FALLBACK_MESSAGE } from './errors'

describe('errorMessage', () => {
  it.each([...ERROR_CODES])('maps %s to a Persian sentence', (code) => {
    const message = errorMessage(code)
    expect(message).not.toBe(FALLBACK_MESSAGE)
    expect(message).not.toMatch(/[A-Za-z0-9]/)
    expect(message.length).toBeGreaterThan(10)
  })

  it('gives every code its own sentence', () => {
    const messages = ERROR_CODES.map((code) => errorMessage(code))
    expect(new Set(messages).size).toBe(ERROR_CODES.length)
  })

  it('falls back for an unknown or empty code', () => {
    expect(errorMessage('SOMETHING_NEW')).toBe(FALLBACK_MESSAGE)
    expect(errorMessage('')).toBe(FALLBACK_MESSAGE)
    expect(errorMessage('constructor')).toBe(FALLBACK_MESSAGE)
    expect(errorMessage('__proto__')).toBe(FALLBACK_MESSAGE)
    expect(FALLBACK_MESSAGE).not.toMatch(/[A-Za-z0-9]/)
  })
})

describe('describeError', () => {
  it('uses the code when the error carries one', () => {
    expect(describeError({ code: 'NOT_FOUND' })).toBe(errorMessage('NOT_FOUND'))
  })

  it('uses the generic body for anything else', () => {
    expect(describeError(new Error('ECONNREFUSED'))).toBe(copy.errors.body)
    expect(describeError(null)).toBe(copy.errors.body)
    expect(describeError({ code: 42 })).toBe(copy.errors.body)
  })
})
