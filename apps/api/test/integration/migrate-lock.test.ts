import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
// The barrel, never src/migrate.ts: naming the constant there would migrate
// the importer's database on import (§6.2).
import { MIGRATION_LOCK_KEY } from '../../src/infra/db/index.js'

/**
 * What `pnpm db:migrate` and the Liara release command actually run. Compiled,
 * not through tsx, so this is the deploy's own code path (§5.2).
 */
const migrateEntrypoint = fileURLToPath(new URL('../../dist/migrate.js', import.meta.url))

/**
 * pg's own default. It is the window src/migrate.ts pins a single client for:
 * the advisory lock is session-level, and a client that goes idle for this
 * long is reaped, taking the lock with it and telling nobody.
 */
const PG_IDLE_TIMEOUT_MS = 10_000

/** Two databases of this file's own: the suite's must not be migrated twice. */
const BLOCKED_DB = 'migrate_lock_blocked'
const FAILING_DB = 'migrate_lock_failing'

function containerUrl(): URL {
  const base = process.env.DATABASE_URL
  if (base === undefined) {
    throw new Error('DATABASE_URL is unset; the Testcontainers global setup writes it.')
  }
  return new URL(base)
}

/** The same Postgres container, a different database on it. */
function urlFor(database: string): string {
  const url = containerUrl()
  url.pathname = `/${database}`
  return url.toString()
}

/** The database the global setup migrated; these two are created beside it. */
function suiteDatabase(): string {
  return containerUrl().pathname.slice(1)
}

async function withClient<T>(database: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: urlFor(database) })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

interface Migrator {
  readonly child: ChildProcess
  readonly exited: Promise<{ code: number | null; stderr: string }>
}

/**
 * Every migrator this file started, so afterAll can kill the ones that never
 * exited. A migrator that holds its session forever is exactly what the first
 * test is watching for, and its stdio pipes would otherwise keep the vitest
 * worker alive long past the failed assertion — a wedged run instead of a
 * red one.
 */
const started = new Set<ChildProcess>()

function startMigrator(database: string): Migrator {
  const child = spawn(process.execPath, [migrateEntrypoint], {
    env: { ...process.env, DATABASE_URL: urlFor(database) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  started.add(child)
  let stderr = ''
  // Non-nullable: the stdio tuple above pipes it.
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
  })
  const exited = new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    child.on('close', (code) => {
      resolve({ code, stderr })
    })
    child.on('error', reject)
  })
  return { child, exited }
}

/** Sessions queued behind the migration lock on `database`, right now. */
async function waitersFor(database: string): Promise<number> {
  return withClient(suiteDatabase(), async (client) => {
    const res = await client.query<{ n: number }>(
      `select count(*)::int as n
         from pg_locks
        where locktype = 'advisory'
          and database = (select oid from pg_database where datname = $1)
          -- pg splits the bigint key across classid (high 32 bits) and objid
          -- (low 32); MIGRATION_LOCK_KEY fits in 32, so classid is 0.
          and classid = 0
          and objid = $2::oid
          and objsubid = 1
          and not granted`,
      [database, MIGRATION_LOCK_KEY],
    )
    return res.rows[0]?.n ?? 0
  })
}

describe('the migration lock', () => {
  beforeAll(async () => {
    await withClient(suiteDatabase(), async (client) => {
      for (const database of [BLOCKED_DB, FAILING_DB]) {
        await client.query(`drop database if exists ${database}`)
        await client.query(`create database ${database}`)
      }
    })
    // A journal table drizzle's migrator will not create (IF NOT EXISTS) and
    // cannot read: its next statement selects id, hash and created_at. The
    // failure therefore lands between the lock and the unlock, which is the
    // only place this file cares about.
    await withClient(FAILING_DB, async (client) => {
      await client.query('create schema drizzle')
      await client.query('create table drizzle.__drizzle_migrations (unexpected integer)')
    })
  })

  afterAll(async () => {
    for (const child of started) if (child.exitCode === null) child.kill('SIGKILL')
    started.clear()
    await withClient(suiteDatabase(), async (client) => {
      for (const database of [BLOCKED_DB, FAILING_DB]) {
        // A killed migrator's session may outlive it for a moment, and a
        // database with a connection on it cannot be dropped.
        await client.query(
          'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1',
          [database],
        )
        await client.query(`drop database if exists ${database}`)
      }
    })
  })

  /**
   * §6.2: a migration that fails partway holds the lock at the moment it
   * throws, and there is no unlock on that path — the session ending is what
   * frees it, so the next deploy must not find the database claimed by a
   * migrator that is no longer running. Measured, not assumed: a migrator that
   * kept its client checked out never exits, which fails this by timing out.
   * (Merely leaving the pool open does not: `client.release()` puts the client
   * back, and pg reaps it after idleTimeoutMillis, taking the lock with it.)
   */
  it('releases the lock after a failed migration, and exits', async () => {
    const { code, stderr } = await startMigrator(FAILING_DB).exited

    // Liara keeps the previous release serving only on a non-zero exit.
    expect(code).toBe(1)
    expect(stderr).toContain('[migrate] failed:')

    const claimed = await withClient(FAILING_DB, async (client) => {
      const res = await client.query<{ locked: boolean }>(
        'select pg_try_advisory_lock($1::bigint) as locked',
        [MIGRATION_LOCK_KEY],
      )
      return res.rows[0]?.locked ?? false
    })
    expect(claimed).toBe(true)
  }, 30_000)

  /**
   * §6.2: two containers starting at once must not both migrate. The lock is
   * held here rather than by a first migrator, because a real migration
   * finishes in milliseconds and nothing could be observed inside it — so what
   * this pins is the waiting side: both migrators block, for longer than pg
   * would keep an idle client, and only then do their work, once, in turn.
   */
  it('makes a second migrator wait rather than race, however long the wait', async () => {
    const holder = new pg.Client({ connectionString: urlFor(BLOCKED_DB) })
    await holder.connect()
    await holder.query('select pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_KEY])

    const first = startMigrator(BLOCKED_DB)
    const second = startMigrator(BLOCKED_DB)
    try {
      await sleep(PG_IDLE_TIMEOUT_MS + 2_000)

      // Neither has run. Without the lock — or with pg_try_advisory_lock and a
      // carry-on — both would have migrated and exited seconds ago.
      expect(first.child.exitCode).toBeNull()
      expect(second.child.exitCode).toBeNull()
      expect(await waitersFor(BLOCKED_DB)).toBe(2)
    } finally {
      await holder.query('select pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_KEY])
      await holder.end()
    }

    const results = await Promise.all([first.exited, second.exited])
    for (const { code, stderr } of results) {
      expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    }

    // Each migration applied once, by whichever went first: the other took the
    // lock afterwards, read the journal and had nothing left to do. Counted as
    // rows against distinct hashes rather than against a number, so adding a
    // migration does not make this fail for an unrelated reason — two racing
    // migrators both read an empty journal and insert the same hash twice.
    const journal = await withClient(BLOCKED_DB, async (client) => {
      const res = await client.query<{ rows: number; hashes: number }>(
        `select count(*)::int as rows, count(distinct hash)::int as hashes
           from drizzle.__drizzle_migrations`,
      )
      return res.rows[0] ?? { rows: 0, hashes: 0 }
    })
    expect(journal.rows).toBeGreaterThan(0)
    expect(journal.rows).toBe(journal.hashes)
  }, 60_000)
})
