import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService, type HealthCheckAttempt } from '@nestjs/terminus'
import { and, count, gte, isNull } from 'drizzle-orm'
import { DRIZZLE, type Db } from '../db/index.js'
import { MAX_ATTEMPTS, outboxEvents } from '../outbox/index.js'
import { unwrapDriverError } from './driver-error.js'
import { POSTGRES_PROBE_TIMEOUT_MS } from './probe-timeout.js'

/**
 * How many events the relay has given up on. `status` is a reserved key in a
 * detail object (ADR-0001), so the count is named `dead`.
 *
 * A count that comes back — however large — is `up`, never `down` or
 * `degraded`: parked events need a human, but the service is still serving and
 * Liara must keep routing. A count that cannot be read at all is a different
 * thing, and `attempt()` marks it `down`, which is also what keeps the failure
 * inside Terminus: `HealthCheckExecutor.executeHealthIndicators` *rethrows*
 * whatever an indicator rejects with rather than recording it, so an
 * uncaught query error would skip `HealthCheckService` entirely and land on
 * the global filter as a bare 500 INTERNAL — no 503, and no `details` naming
 * the store that is actually down.
 */
@Injectable()
export class OutboxIndicator {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly health: HealthIndicatorService,
  ) {}

  check(): HealthCheckAttempt<'outbox'> {
    return this.health
      .check('outbox')
      .attempt(async () => {
        try {
          const [row] = await this.db
            .select({ dead: count() })
            .from(outboxEvents)
            .where(and(isNull(outboxEvents.publishedAt), gte(outboxEvents.attempts, MAX_ATTEMPTS)))
          return { dead: row?.dead ?? 0 }
        } catch (error) {
          throw unwrapDriverError(error)
        }
      })
      .withTimeout(POSTGRES_PROBE_TIMEOUT_MS)
  }
}
