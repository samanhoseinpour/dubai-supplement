import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus'
import { and, count, gte, isNull } from 'drizzle-orm'
import { DRIZZLE, type Db } from '../db/index.js'
import { MAX_ATTEMPTS, outboxEvents } from '../outbox/index.js'

/**
 * How many events the relay has given up on. `status` is a reserved key in a
 * detail object (ADR-0001), so the count is named `dead`.
 */
@Injectable()
export class OutboxIndicator {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check('outbox')
    try {
      const [row] = await this.db
        .select({ dead: count() })
        .from(outboxEvents)
        .where(and(isNull(outboxEvents.publishedAt), gte(outboxEvents.attempts, MAX_ATTEMPTS)))

      // Deliberately `up`, never `down` or `degraded`: parked events need a
      // human, but the service is still serving and Liara must keep routing.
      return indicator.up({ dead: row?.dead ?? 0 })
    } catch (error) {
      // Not the same thing as a parked event: this is a count that could not
      // be read at all, which means Postgres is away. Terminus's executor
      // rethrows whatever an indicator rejects with rather than recording it,
      // so letting this escape would skip HealthCheckService entirely and
      // land on the global filter as a bare 500 INTERNAL — no 503, and no
      // `details` naming the store that is actually down.
      return indicator.down({ message: error instanceof Error ? error.message : 'unreadable' })
    }
  }
}
