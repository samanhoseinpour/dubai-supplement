import { ApiResponse } from '@nestjs/swagger'
import type { z } from 'zod'

/**
 * `ApiResponse({ schema })` types `schema` as a closed OAS-3.0 SchemaObject
 * with no index signature, so a draft-2020-12 object literal fails excess
 * property checking. v12's `standardSchema` field takes the Zod schema
 * directly and lets Nest do the conversion (§5.5, corrected 2026-09-23).
 */
export function ApiZodResponse(status: number, schema: z.ZodType): MethodDecorator {
  return ApiResponse({ status, standardSchema: schema })
}
