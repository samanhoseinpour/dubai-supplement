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
 *
 * The guard tests the type, not just `undefined` and `''`, because the way
 * this gets called wrong is `beforeEach(flushRedis)` — vitest hands a hook
 * its TestContext as the first argument, and neither of those two
 * comparisons rejects one. What ioredis 5.11.1 then does depends on the
 * shape it is handed, and both outcomes were measured: an ordinary object
 * becomes an options bag and falls back to host `localhost`, port 6379,
 * db 0, which flushdb() then empties; vitest 5.0.1's TestContext happens to
 * be a *function* (a callable object carrying `task`, `expect`, `skip` and
 * the rest, whose body is the deprecated `done()` shim), and ioredis
 * refuses a function with `Invalid argument function() { throw new
 * Error("done() callback is deprecated, use promise instead") }` — a
 * message that names nothing about Redis or about this helper. So today the
 * mistake is merely baffling rather than destructive, and it is one vitest
 * release away from being destructive again. This guard is what makes it
 * neither. Callers pass a URL; test/setup/fixture.ts shows the shape.
 */
export async function flushRedis(url = process.env.REDIS_URL): Promise<void> {
  if (typeof url !== 'string' || url === '') {
    throw new Error(
      `flushRedis() needs a Redis URL and received ${typeof url}; the Testcontainers ` +
        'global setup writes one. If this came from `beforeEach(flushRedis)`, that hands ' +
        "the hook vitest's TestContext — wrap it and pass the URL the app under test was " +
        'built from, as test/setup/fixture.ts does.',
    )
  }
  const redis = new Redis(url)
  try {
    await redis.flushdb()
  } finally {
    redis.disconnect()
  }
}
