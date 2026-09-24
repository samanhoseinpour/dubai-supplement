import { Redis } from 'ioredis'
import type { AppConfig } from '../config/index.js'

/**
 * The one ioredis client. It lives here rather than in redis.module.ts so
 * that key-value.store.ts can inject it without the two files importing each
 * other: `@Inject(REDIS)` is evaluated while the class is being decorated, so
 * a cycle would read the token in its temporal dead zone and throw at import
 * time, not at wiring time. Same split as db/drizzle.provider.ts.
 */
export const REDIS = Symbol('REDIS')

/**
 * Lazy: ioredis opens no socket until the first command, which is what lets
 * src/openapi.ts boot the app with no services (§5.5). The throttler storage
 * and the KeyValueStore both receive this instance — one connection, not two.
 */
export function createRedis(config: AppConfig): Redis {
  return new Redis(config.redisUrl, { lazyConnect: true })
}
