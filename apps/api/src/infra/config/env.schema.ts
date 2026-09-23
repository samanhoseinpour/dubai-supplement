import { isIP } from 'node:net'
import { z } from 'zod'

const NUMERIC_ONLY = /^\d+$/u
const PROXY_ADDR_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal'])

/**
 * Why `entry` cannot be handed to proxy-addr, or `null` when it is one of
 * its presets or an IP address with an optional prefix length. A /0 prefix
 * is refused on purpose: it trusts every address, which is what `true`
 * means, and the per-IP throttle (§5.8) depends on a truthful client IP.
 */
function trustProxyEntryProblem(entry: string): string | null {
  if (PROXY_ADDR_PRESETS.has(entry)) return null
  const slash = entry.lastIndexOf('/')
  const address = slash === -1 ? entry : entry.slice(0, slash)
  const family = isIP(address)
  if (family === 0) {
    return `TRUST_PROXY entry "${entry}" is neither a preset (loopback, linklocal, uniquelocal) nor an IP address or CIDR.`
  }
  if (slash === -1) return null
  const prefix = entry.slice(slash + 1)
  const max = family === 6 ? 128 : 32
  if (!NUMERIC_ONLY.test(prefix) || Number(prefix) > max) {
    return `TRUST_PROXY entry "${entry}" has an invalid prefix length; expected /1 to /${String(max)}.`
  }
  if (Number(prefix) === 0) {
    return `TRUST_PROXY entry "${entry}" is a /0 prefix: it trusts every address, which is what "true" means, so any client could forge X-Forwarded-For. Name the networks you trust.`
  }
  return null
}

/**
 * `trustProxy` is handed straight to Fastify. Fastify 5.12.5 returns
 * `() => false` for a number — trusting nothing, with no error — so a hop
 * count must be refused here or the throttler silently keys every request
 * on the proxy's address (ADR-0001, §5.5).
 */
const trustProxy = z
  .string()
  .min(1)
  .refine((v) => !NUMERIC_ONLY.test(v.trim()), {
    abort: true,
    message:
      'TRUST_PROXY is never a number: Fastify treats a hop count as "trust nothing". ' +
      'Use a CIDR list or the presets loopback, linklocal, uniquelocal.',
  })
  .refine((v) => v.trim() !== 'true' && v.trim() !== 'false', {
    abort: true,
    message: 'TRUST_PROXY must not be a boolean; name the networks you trust.',
  })
  // Fastify splits on commas and trims each entry before proxy-addr sees it.
  .superRefine((v, ctx) => {
    for (const entry of v.split(',').map((s) => s.trim())) {
      const problem = trustProxyEntryProblem(entry)
      if (problem !== null) ctx.addIssue({ code: 'custom', message: problem })
    }
  })

const corsOrigins = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .refine((list) => list.every((o) => o !== '*' && o !== 'null'), {
    message: 'CORS_ORIGINS may not contain * or null.',
  })

export const EnvSchema = z.object({
  // Required, no default: the logger reaches for pino-pretty — a devDependency
  // — only in development, so a deploy that forgets NODE_ENV must fail here,
  // naming the key, not inside a transport worker that cannot load the module.
  // Vitest sets `test` in-process; `.env.example` carries `development`.
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PROCESS_ROLE: z.enum(['api', 'worker', 'all']).default('api'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1).default('default'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  CORS_ORIGINS: corsOrigins,
  TRUST_PROXY: trustProxy.default('loopback,uniquelocal'),

  OUTBOX_POLL_MS: z.coerce.number().int().min(50).default(1000),

  OPENAPI_UI_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

export type Env = z.infer<typeof EnvSchema>
