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
})
