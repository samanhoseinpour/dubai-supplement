import type { ErrorCode, ProblemDetails } from '@ds/contracts'

/**
 * A problem+json response as an exception (foundation §7.6). The storefront
 * maps `code` to a Persian sentence in lib/errors.ts; `instance` is the
 * request id, worth logging next to any report.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly detail: string | undefined
  readonly instance: string
  readonly errors: ProblemDetails['errors']

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.code = problem.code
    this.detail = problem.detail
    this.instance = problem.instance
    this.errors = problem.errors
  }
}

/**
 * A structural check, not a Zod parse: this package takes only types from
 * @ds/contracts (north-star §2 rule 2), and the API is our own, so a
 * problem-shaped body is trusted as one.
 */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['type'] === 'string' &&
    typeof v['title'] === 'string' &&
    typeof v['status'] === 'number' &&
    typeof v['instance'] === 'string' &&
    typeof v['code'] === 'string'
  )
}
