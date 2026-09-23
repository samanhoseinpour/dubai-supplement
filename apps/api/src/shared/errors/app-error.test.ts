import { describe, expect, it } from 'vitest'
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from './index.js'

describe('AppError', () => {
  it('maps each subclass to its HTTP status', () => {
    expect(new AppError('INTERNAL').status).toBe(500)
    expect(new ValidationError([]).status).toBe(400)
    expect(new UnauthorizedError('UNAUTHORIZED').status).toBe(401)
    expect(new ForbiddenError('FORBIDDEN').status).toBe(403)
    expect(new NotFoundError('CATALOG_BRAND_NOT_FOUND').status).toBe(404)
    expect(new ConflictError('CATALOG_BRAND_SLUG_TAKEN').status).toBe(409)
    expect(new RateLimitedError('RATE_LIMITED').status).toBe(429)
  })

  it('is a real Error with a usable stack and name', () => {
    const err = new NotFoundError('NOT_FOUND', 'no such brand')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
    expect(err.name).toBe('NotFoundError')
    expect(err.stack).toBeDefined()
    expect(err.detail).toBe('no such brand')
  })

  // `message` is what a stack trace and a log line show: the detail when
  // there is one, otherwise the code — never an empty string.
  it('uses the detail as its message and falls back to the code', () => {
    expect(new NotFoundError('NOT_FOUND', 'no such brand').message).toBe('no such brand')
    expect(new NotFoundError('NOT_FOUND').message).toBe('NOT_FOUND')
  })

  it('keeps meta for the log without promising to serialize it', () => {
    const err = new AppError('INTERNAL', 'boom', { attempt: 3 })
    expect(err.meta).toEqual({ attempt: 3 })
  })

  it('carries Standard Schema issues on ValidationError', () => {
    const err = new ValidationError([{ message: 'expected number', path: ['page'] }])
    expect(err.issues).toHaveLength(1)
    expect(err.code).toBe('VALIDATION_FAILED')
    expect(err.name).toBe('ValidationError')
  })
})
