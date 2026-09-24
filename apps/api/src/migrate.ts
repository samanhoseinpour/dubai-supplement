import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
// Three deep imports, all for the same reason: either barrel carries
// ConfigModule, whose forRoot validates the environment the moment it is
// imported — before this file's own loadEnvFile and outside the try below.
// That Nest machinery is what this script stays free of so tsx may run it
// (§4.2). All three targets are leaves that import nothing.
import { EnvSchema } from './infra/config/env.schema.js'
import { CONNECT_TIMEOUT_MS } from './infra/db/connect-timeout.js'
import { MIGRATION_LOCK_KEY } from './infra/db/migration-lock.js'

// Everything the operator could get wrong runs inside the try, so every
// failure leaves the same `[migrate] failed:` line in the deploy log — a
// ZodError thrown out here would exit 1 with nothing to grep for.
let pool: pg.Pool | undefined
try {
  const envFile = fileURLToPath(new URL('../.env', import.meta.url))
  if (existsSync(envFile)) process.loadEnvFile(envFile)

  const env = EnvSchema.parse(process.env)
  // Bounded like the application's pool. A database that accepts the socket
  // and then says nothing — a blackholed route, a failover mid-flight — would
  // otherwise leave `connect()` below with no bound at all, and a migrator
  // that hangs instead of exiting non-zero hangs the whole deploy: Liara is
  // waiting on the release command, not on a health check. Only the wait for
  // the *connection* is bounded; the advisory lock below still waits as long
  // as the other container needs, which is this file's entire purpose (§6.2).
  pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  })
  // One checked-out client for the whole sequence. The lock is session-level,
  // and a pool hands each statement whichever client is free — between two of
  // them the client goes idle and pg reaps it after idleTimeoutMillis (10 s by
  // default), taking the lock with it and telling nobody. Serialising two
  // containers is this file's whole purpose, so the session must be pinned.
  const client = await pool.connect()
  try {
    const db = drizzle(client)
    // Two containers starting at once must not both migrate. The lock is
    // released explicitly on success; on failure the session ending with the
    // pool in `finally` releases it (§6.2).
    await db.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
    await db.execute(sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`)
  } finally {
    client.release()
  }
} catch (error) {
  console.error('[migrate] failed:', error)
  // Non-zero so Liara keeps the previous release serving (§6.2).
  process.exitCode = 1
} finally {
  await pool?.end()
}
