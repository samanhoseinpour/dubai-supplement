import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
// The schema itself, not the config barrel: the barrel carries ConfigModule,
// whose forRoot validates the environment the moment it is imported — Nest
// machinery this script stays free of, which is why tsx may run it (§4.2).
import { EnvSchema } from './infra/config/env.schema.js'

/** The fixed advisory-lock key overlapping starts serialise on (§6.2). */
export const MIGRATION_LOCK_KEY = 4_820_115

const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const env = EnvSchema.parse(process.env)
// One client, so every statement below runs on one session: the lock is
// session-level, and its unlock must land where the lock did.
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 1 })
const db = drizzle(pool)

try {
  // Two containers starting at once must not both migrate. The lock is
  // released explicitly on success; on failure the session ending in
  // `finally` releases it (§6.2).
  await db.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`)
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  await db.execute(sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`)
} catch (error) {
  console.error('[migrate] failed:', error)
  // Non-zero so Liara keeps the previous release serving (§6.2).
  process.exitCode = 1
} finally {
  await pool.end()
}
