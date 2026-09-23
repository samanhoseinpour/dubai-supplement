import { z } from 'zod'
import { normalizePersian } from '@ds/persian'

export const id = z.uuid()

export const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/u, 'must be lowercase Latin letters, digits and hyphens')
  .max(64)

/**
 * HTTP inputs are normalized here; the domain entity normalizes again on
 * write (§6.3), so both paths agree. Zod 4.6 counts code points, which is
 * the semantics we want — a ZWNJ costs one. Whitespace-only input is
 * rejected but never trimmed: `@ds/persian` stays the single authority on
 * what stored text looks like, so no second normalization happens here.
 */
export function persianText(max: number): z.ZodType<string> {
  return z.preprocess(
    (v) => (typeof v === 'string' ? normalizePersian(v) : v),
    z
      .string()
      .min(1)
      .max(max)
      .refine((s) => s.trim().length > 0, 'must not be blank'),
  )
}

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  })
}
