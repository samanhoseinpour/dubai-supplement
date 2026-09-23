import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { ErrorCode, ProblemDetails } from '@ds/contracts'
import type { Env } from '../config/index.js'
import { AppError, ValidationError } from '../../shared/errors/index.js'

/** RFC 9457 `title`: one English constant per code (spec §5.5). */
export const TITLE_BY_CODE: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Validation Failed',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not Found',
  CONFLICT: 'Conflict',
  RATE_LIMITED: 'Rate Limited',
  INTERNAL: 'Internal Server Error',
  CATALOG_BRAND_NOT_FOUND: 'Brand Not Found',
  CATALOG_BRAND_SLUG_TAKEN: 'Brand Slug Taken',
}

/**
 * The generic code for an HttpException Nest or Fastify raised on its own:
 * the router's 404, the body parser's 400/413/415, the throttler's 429.
 */
const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'VALIDATION_FAILED',
  415: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
}

/**
 * The slice of Fastify's reply the filter drives, typed structurally: the
 * api depends on `@nestjs/platform-fastify`, not on `fastify` itself, so
 * its types are not importable here.
 */
interface ProblemReply {
  status(statusCode: number): ProblemReply
  type(contentType: string): ProblemReply
  send(payload: ProblemDetails): unknown
}

interface IdentifiedRequest {
  /**
   * Decided by Fastify before any handler runs. `LoggerModule` makes it the
   * validated inbound `x-request-id` or a minted UUID, so it is always a
   * plain token and safe to echo as RFC 9457 `instance`.
   */
  readonly id: string
}

interface Classification {
  status: number
  code: ErrorCode
  detail?: string | undefined
  errors?: ProblemDetails['errors']
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(private readonly nodeEnv: Env['NODE_ENV']) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const reply = http.getResponse<ProblemReply>()
    const request = http.getRequest<IdentifiedRequest>()

    const { status, code, detail, errors } = this.classify(exception)

    const body: ProblemDetails = {
      type: `urn:problem:${code}`,
      title: TITLE_BY_CODE[code],
      status,
      instance: request.id,
      code,
      ...(detail === undefined ? {} : { detail }),
      ...(errors === undefined ? {} : { errors }),
    }

    reply.status(status).type('application/problem+json').send(body)
  }

  private classify(exception: unknown): Classification {
    if (exception instanceof ValidationError) {
      return {
        status: exception.status,
        code: exception.code,
        detail: exception.detail,
        // Zod issue paths are PropertyKey[]; the Standard Schema spec also
        // permits `{ key }` segments, which a bare String() would render as
        // "[object Object]". The wire shape pins `a.1`, not `a[1]` (spec §5.5).
        errors: exception.issues.map((issue) => ({
          path: (issue.path ?? [])
            .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
            .join('.'),
          message: issue.message,
        })),
      }
    }

    if (exception instanceof AppError) {
      return { status: exception.status, code: exception.code, detail: exception.detail }
    }

    // Nest's and Fastify's own exceptions carry messages written for a
    // developer ("Cannot GET /nope"); the status is the whole contract.
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      return { status, code: CODE_BY_STATUS[status] ?? 'INTERNAL' }
    }

    // Anything else is a bug. In production the message never leaves the
    // process (§5.5); elsewhere it is the fastest way to the cause.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL',
      ...(this.nodeEnv === 'production'
        ? {}
        : { detail: exception instanceof Error ? exception.message : String(exception) }),
    }
  }
}
