import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import type { AppConfig } from '../config/index.js'
import { CONNECT_TIMEOUT_MS } from './connect-timeout.js'

export const DRIZZLE = Symbol('DRIZZLE')
export const PG_POOL = Symbol('PG_POOL')

// No `schema` option on purpose, so this is NodePgDatabase over its default,
// empty schema type: db.query.* is not used, each repository imports only its
// own module's tables, and no aggregate schema file exists (§6.1).
export type Db = NodePgDatabase

/**
 * Sized from env, bounded by `CONNECT_TIMEOUT_MS`. Nothing connects here: pg
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
