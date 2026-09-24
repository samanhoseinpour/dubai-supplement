import { Controller, Get, UseFilters } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'
import { SkipThrottle } from '@nestjs/throttler'
import { HealthCheckFilter } from './health-check.filter.js'
import { OutboxIndicator } from './outbox.indicator.js'
import { PostgresIndicator } from './postgres.indicator.js'
import { RedisIndicator } from './redis.indicator.js'

/**
 * `@SkipThrottle()`: `ThrottlerGuard` is a global `APP_GUARD` over Redis-backed
 * storage, so without this it runs ahead of both routes and increments a
 * counter in Redis on every probe. Measured against a Redis that is not
 * answering: `GET /health/live` returned **500 after 10.5 s** — the guard
 * waiting out ioredis's twenty reconnect attempts, then
 * `MaxRetriesPerRequestError` falling through to the global `ProblemFilter` as
 * INTERNAL. The Docker `HEALTHCHECK` is on `/health/live` precisely so a Redis
 * blip does not restart-loop the container, and a liveness probe that 500s
 * during one does exactly that. Readiness would have been no better: it must
 * answer 503 naming redis, not 500 naming nothing.
 *
 * Both routes are therefore uncounted. That is affordable because the API is
 * not publicly reachable (north star §4) — the only callers are Liara's health
 * checker and the container's own HEALTHCHECK — and because a rate limiter
 * that cannot be reached without the store it protects is no limiter at all.
 */
@Controller('health')
@UseFilters(HealthCheckFilter)
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresIndicator,
    private readonly redis: RedisIndicator,
    private readonly outbox: OutboxIndicator,
  ) {}

  // Liveness: the process is up and answering. It reaches for nothing, so a
  // store that is away can never restart the container.
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([])
  }

  // Readiness: Liara's `healthCheck` points here, so a container that cannot
  // reach its stores never takes traffic (§5.5).
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.postgres.check(),
      () => this.redis.check(),
      () => this.outbox.check(),
    ])
  }
}
