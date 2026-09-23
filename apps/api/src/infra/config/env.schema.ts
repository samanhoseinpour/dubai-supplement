import { z } from 'zod'

const NUMERIC_ONLY = /^\d+$/u

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
    message:
      'TRUST_PROXY is never a number: Fastify treats a hop count as "trust nothing". ' +
      'Use a CIDR list or the presets loopback, linklocal, uniquelocal.',
  })
  .refine((v) => v.trim() !== 'true' && v.trim() !== 'false', {
    message: 'TRUST_PROXY must not be a boolean; name the networks you trust.',
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
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
