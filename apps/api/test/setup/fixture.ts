import type { ModuleMetadata } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import { AppConfig, ConfigModule } from '../../src/infra/config/index.js'
import { DbModule, DRIZZLE, type Db } from '../../src/infra/db/index.js'
import { flushRedis, truncateAll } from './truncate.js'

/** What `withDb` hands a test: one app, one pool, and the two verbs. */
export interface DbFixture {
  readonly app: TestingModule
  readonly db: Db
  /** The §6.6 isolation step, whole: every table emptied and Redis flushed. */
  reset: () => Promise<void>
  close: () => Promise<void>
}

/**
 * The data layer plus whatever the file under test needs, booted once.
 *
 * Every integration test from here on wants the same three lines — compile a
 * module over ConfigModule and DbModule, `init()` it, resolve DRIZZLE — and
 * then a way to get back to an empty database. They live here so each file
 * does not re-derive them, and so `reset()` is the same thing everywhere.
 *
 * Booted once per file rather than per test on purpose: `Test.createTestingModule`
 * builds a new pg.Pool each time and only the last one would ever be closed.
 */
export async function withDb(
  ...imports: NonNullable<ModuleMetadata['imports']>
): Promise<DbFixture> {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule, DbModule, ...imports],
  }).compile()
  const app = await moduleRef.init()
  const db = app.get<Db>(DRIZZLE)
  // The app's own Redis URL rather than process.env, so the instance a test
  // flushes is the instance its app talks to — by construction.
  const { redisUrl } = app.get(AppConfig)
  return {
    app,
    db,
    reset: async () => {
      await resetDb(db)
      await flushRedis(redisUrl)
    },
    close: () => app.close(),
  }
}

/**
 * Every table the migrations created, emptied. Isolation is truncation, not
 * transaction rollback (§6.6).
 *
 * The table list is read from the server rather than written down, so a task
 * that adds a table gets isolation for it without touching this file — and so
 * a list that quietly falls behind cannot leave rows between tests. Drizzle's
 * journal lives in the `drizzle` schema, so it is out of scope by construction
 * rather than by exclusion.
 */
export async function resetDb(db: Db): Promise<void> {
  const res = await db.execute(sql`select tablename from pg_tables where schemaname = 'public'`)
  await truncateAll(
    db,
    res.rows.map((row) => (row as { tablename: string }).tablename),
  )
}
