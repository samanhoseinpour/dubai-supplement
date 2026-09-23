import { describe, expect, it } from 'vitest'
import { ERROR_CODES, ProblemDetailsSchema } from './index.js'

describe('ErrorCode', () => {
  it('holds exactly the nine codes the spec names', () => {
    expect([...ERROR_CODES].sort()).toEqual(
      [
        'CATALOG_BRAND_NOT_FOUND',
        'CATALOG_BRAND_SLUG_TAKEN',
        'CONFLICT',
        'FORBIDDEN',
        'INTERNAL',
        'NOT_FOUND',
        'RATE_LIMITED',
        'UNAUTHORIZED',
        'VALIDATION_FAILED',
      ].sort(),
    )
  })
})

describe('ProblemDetailsSchema', () => {
  it('accepts an RFC 9457 body without the optional errors array', () => {
    const problem = {
      type: 'urn:problem:NOT_FOUND',
      title: 'Not Found',
      status: 404,
      instance: 'req-1',
      code: 'NOT_FOUND',
    }
    expect(ProblemDetailsSchema.parse(problem)).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('accepts a validation body carrying field errors', () => {
    const problem = {
      type: 'urn:problem:VALIDATION_FAILED',
      title: 'Validation Failed',
      status: 400,
      instance: 'req-2',
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'page', message: 'expected number' }],
    }
    expect(ProblemDetailsSchema.parse(problem).errors).toHaveLength(1)
  })

  it('rejects a code outside the enum', () => {
    expect(() =>
      ProblemDetailsSchema.parse({
        type: 'urn:problem:NOPE',
        title: 'Nope',
        status: 418,
        instance: 'req-3',
        code: 'NOPE',
      }),
    ).toThrow()
  })

  it('rejects a body missing a required member', () => {
    expect(() =>
      ProblemDetailsSchema.parse({
        type: 'urn:problem:NOT_FOUND',
        title: 'Not Found',
        status: 404,
        code: 'NOT_FOUND',
      }),
    ).toThrow()
  })

  it('rejects a non-integer status', () => {
    expect(() =>
      ProblemDetailsSchema.parse({
        type: 'urn:problem:NOT_FOUND',
        title: 'Not Found',
        status: 404.5,
        instance: 'req-4',
        code: 'NOT_FOUND',
      }),
    ).toThrow()
  })

  it('rejects a malformed errors member', () => {
    const problem = {
      type: 'urn:problem:VALIDATION_FAILED',
      title: 'Validation Failed',
      status: 400,
      instance: 'req-5',
      code: 'VALIDATION_FAILED',
    }
    expect(() => ProblemDetailsSchema.parse({ ...problem, errors: 'oops' })).toThrow()
    expect(() => ProblemDetailsSchema.parse({ ...problem, errors: [{ path: 'page' }] })).toThrow()
    // A raw Zod issue carries path as an array; the wire shape is a string.
    expect(() =>
      ProblemDetailsSchema.parse({ ...problem, errors: [{ path: ['page'], message: 'bad' }] }),
    ).toThrow()
  })
})
