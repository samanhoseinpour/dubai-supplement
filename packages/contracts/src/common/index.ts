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
 * the semantics we want — a ZWNJ costs one.
 *
 * Nothing is normalized a second time in this package: `normalizePersian`
 * trims, so `.max(max)` measures the text that will be stored rather than
 * the padding a client happened to send, and `'   '` reaches `.min(1)` as
 * `''`. A `.refine(s => s.trim().length > 0)` after that preprocess could
 * never fire — a dead guard reads as a check and is not one — so the blank
 * case is left to `.min(1)`, which is the assertion that actually runs.
 */
export function persianText(max: number): z.ZodType<string> {
  return z.preprocess(
    (v) => (typeof v === 'string' ? normalizePersian(v) : v),
    z.string().min(1).max(max),
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
