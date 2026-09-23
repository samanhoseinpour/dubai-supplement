import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import type { ThrottlerModuleOptions } from '@nestjs/throttler'
import type { Redis } from 'ioredis'

// Constants, not env: a rate limit that varies per environment is a rate
// limit nobody can reason about (§5.5).
export const THROTTLE_TTL_MS = 60_000
export const THROTTLE_LIMIT = 120

/** The object form of the module options — the array form has no `storage`. */
export type ThrottlerRootOptions = Exclude<ThrottlerModuleOptions, unknown[]>

/**
 * One global throttler counting in Redis, so a limit survives a restart and
 * holds across instances (ADR-0017). The tracker is Fastify's `req.ip`, which
 * is the forwarded client only because the adapter's `trustProxy` names the
 * proxies (main.ts).
 */
export function buildThrottlerOptions(redis: Redis): ThrottlerRootOptions {
  return {
    throttlers: [{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT }],
    storage: new ThrottlerStorageRedisService(redis),
  }
}
