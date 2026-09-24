import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import type { Db } from '../../src/infra/db/index.js'

/**
 * Isolation is truncation, not transaction rollback: app.inject() and the
 * relay run against the app's own pool and must read committed rows (§6.6).
 *
 * `tables` is a list of literal names written by a test, so quoting them is
 * all the escaping this needs; nothing here ever sees a value from a row.
 */
export async function truncateAll(db: Db, tables: string[]): Promise<void> {
  if (tables.length === 0) return
  const list = tables.map((t) => `"${t}"`).join(', ')
  await db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`))
}

/**
 * The container's Redis, emptied. `url` defaults to what the global setup
 * wrote, and a caller holding an `AppConfig` passes `config.redisUrl` so the
 * instance flushed is the instance it then asserts against — by construction,
 * not because the two happen to agree today.
 *
 * Never a fallback: an absent URL would send `flushdb` to whatever is
 * listening on localhost:6379, which is the developer's own dev stack.
 */
export async function flushRedis(url = process.env.REDIS_URL): Promise<void> {
  if (url === undefined || url === '') {
    throw new Error('flushRedis() needs a Redis URL; the Testcontainers global setup writes one.')
  }
  const redis = new Redis(url)
  try {
    await redis.flushdb()
  } finally {
    redis.disconnect()
  }
}
