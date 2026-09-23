import type { StandardSchemaValidationPipeOptions } from '@nestjs/common'
import type { ErrorCode } from '@ds/contracts'

/**
 * `readonly StandardSchemaV1.Issue[]`, exactly as Nest's
 * `StandardSchemaValidationPipe` hands them to `exceptionFactory` — the one
 * caller that constructs a `ValidationError`. Taken from the pipe's own
 * options rather than imported from `@standard-schema/spec`: that package is
 * a dependency of `@nestjs/common`, not of the api, and pnpm's isolated
 * layout does not let it resolve from here.
 */
export type ValidationIssues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0]

/**
 * The base of every error the API raises on purpose. `code` is the wire
 * contract; `detail` is the public English explanation the filter may send;
 * `meta` is for the log line only and is never serialized into a response.
 */
export class AppError extends Error {
  readonly status: number = 500

  constructor(
    readonly code: ErrorCode,
    readonly detail?: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(detail ?? code)
    this.name = new.target.name
  }
}

/**
 * The one subclass that changes the constructor shape: the validation pipe
 * hands it Standard Schema issues, which the filter serializes into
 * `errors[]`. Not `@nestjs/common`'s `ValidationError` — that one is an
 * interface and cannot be constructed.
 */
export class ValidationError extends AppError {
  override readonly status = 400

  constructor(readonly issues: ValidationIssues) {
    super('VALIDATION_FAILED', 'Request validation failed')
  }
}

export class UnauthorizedError extends AppError {
  override readonly status = 401
}
export class ForbiddenError extends AppError {
  override readonly status = 403
}
export class NotFoundError extends AppError {
  override readonly status = 404
}
export class ConflictError extends AppError {
  override readonly status = 409
}
export class RateLimitedError extends AppError {
  override readonly status = 429
}
