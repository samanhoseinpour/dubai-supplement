import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import type { AppConfig } from '../config/index.js'

export const DRIZZLE = Symbol('DRIZZLE')
export const PG_POOL = Symbol('PG_POOL')

// No `schema` option on purpose, so this is NodePgDatabase over its default,
// empty schema type: db.query.* is not used, each repository imports only its
// own module's tables, and no aggregate schema file exists (§6.1).
export type Db = NodePgDatabase

/**
 * How long any database operation may wait to get a connection.
 *
 * A constant rather than env, for the reason infra/http/throttle.ts gives for
 * the rate limit: a failure policy that varies per environment is a failure
 * policy nobody can reason about. `DATABASE_POOL_MAX` sizes the pool; this
 * decides what happens when the size is not enough, and that answer should be
 * the same everywhere.
 *
 * Read out of pg-pool 3.14.0 rather than assumed: the option covers **two**
 * waits, not one.
 *
 *  - `connect()` (lines 199-236) — waiting in `_pendingQueue` for a busy pool
 *    to release a client. Without the option, the pending item is queued with
 *    no timer at all. With it: `timeout exceeded when trying to connect`.
 *  - `newClient()` (lines 240-262) — establishing a socket. Without the
 *    option, `client.connect()` has no bound whatsoever. With it:
 *    `Connection terminated due to connection timeout`.
 *
 * So the floor is set by ordinary load, not by the network, and both were
 * measured at this value against the suite's own container:
 *
 *  - blackholed address → rejected in 3002 ms (was: still pending at 15 002 ms)
 *  - every client held  → rejected in 3002 ms (was: pending forever)
 *  - queued behind 10 × `pg_sleep(1)` → **resolved in 979 ms**, well clear
 *  - queued behind 10 × `pg_sleep(4)` → rejected in 3001 ms
 *
 * 3 s is therefore ~3× the wait a fully saturated pool of one-second
 * statements imposes, and only trips when every client is held by something
 * slower than three seconds — a database in trouble, where failing fast is the
 * point of a pool timeout. Nothing this API runs comes close.
 *
 * It is deliberately below the health probes' own 5 s ceiling
 * (infra/health/probe-timeout.ts), so a connection problem is reported with
 * pg's specific message and the acquire is actually abandoned, rather than
 * being abandoned only by the probe while the acquire waits on forever.
 */
const CONNECT_TIMEOUT_MS = 3_000

/**
 * Sized from env, bounded by the constant above. Nothing connects here: pg
 * opens its first client on the first query — measured with the timeout set,
 * `totalCount` is 0 after construction and 1 after the first query — which is
 * what lets src/openapi.ts boot the app in CI with no service containers
 * (§5.5).
 */
export function createPool(config: AppConfig): pg.Pool {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  })
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { casing: 'snake_case' })
}
