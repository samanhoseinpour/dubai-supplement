import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService, type HealthCheckAttempt } from '@nestjs/terminus'
import type { Redis } from 'ioredis'
import { REDIS } from '../redis/index.js'
import { REDIS_PROBE_TIMEOUT_MS } from './probe-timeout.js'

/** Redis, reached rather than assumed: one PING, bounded. */
@Injectable()
export class RedisIndicator {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly health: HealthIndicatorService,
  ) {}

  check(): HealthCheckAttempt<'redis'> {
    return this.health
      .check('redis')
      .attempt(async () => {
        await this.redis.ping()
      })
      .withTimeout(REDIS_PROBE_TIMEOUT_MS)
  }
}
