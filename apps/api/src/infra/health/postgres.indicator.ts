import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService, type HealthCheckAttempt } from '@nestjs/terminus'
import { sql } from 'drizzle-orm'
import { DRIZZLE, type Db } from '../db/index.js'
import { unwrapDriverError } from './driver-error.js'
import { POSTGRES_PROBE_TIMEOUT_MS } from './probe-timeout.js'

/**
 * Postgres, reached rather than assumed. `select 1` checks a client out of the
 * pool and runs a statement on it, which is the only thing that distinguishes
 * a reachable database from a configured one: the pool opens no socket until a
 * query asks it to.
 *
 * `attempt().withTimeout()` is Terminus's own: it marks the indicator `down`
 * with the thrown message, or with `timeout of 5000ms exceeded`, and records
 * `responseTime` either way.
 */
@Injectable()
export class PostgresIndicator {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly health: HealthIndicatorService,
  ) {}

  check(): HealthCheckAttempt<'postgres'> {
    return this.health
      .check('postgres')
      .attempt(async () => {
        try {
          await this.db.execute(sql`select 1`)
        } catch (error) {
          throw unwrapDriverError(error)
        }
      })
      .withTimeout(POSTGRES_PROBE_TIMEOUT_MS)
  }
}
