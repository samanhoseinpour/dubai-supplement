import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus'
import { sql } from 'drizzle-orm'
import { DRIZZLE, type Db } from '../db/index.js'

/**
 * Postgres, reached rather than assumed. `select 1` checks a client out of
 * the pool and runs a statement on it, which is the only thing that
 * distinguishes a reachable database from a configured one: the pool opens
 * no socket until a query asks it to.
 */
@Injectable()
export class PostgresIndicator {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check('postgres')
    try {
      await this.db.execute(sql`select 1`)
      return indicator.up()
    } catch (error) {
      return indicator.down({ message: error instanceof Error ? error.message : 'unreachable' })
    }
  }
}
