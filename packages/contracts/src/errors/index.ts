import { z } from 'zod'

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
  'CATALOG_BRAND_NOT_FOUND',
  'CATALOG_BRAND_SLUG_TAKEN',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const ErrorCodeSchema = z.enum(ERROR_CODES)

/** RFC 9457 `application/problem+json` (§5.5). `title` is an English constant per code. */
export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string(),
  code: ErrorCodeSchema,
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
})

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>
