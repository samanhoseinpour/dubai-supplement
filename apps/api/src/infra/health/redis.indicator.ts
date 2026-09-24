import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus'
import type { Redis } from 'ioredis'
import { REDIS } from '../redis/index.js'

/**
 * How long a probe waits for a PONG before calling Redis down.
 *
 * Measured, not chosen: against a closed port ioredis queues the command and
 * rejects it only after twenty reconnect attempts — `MaxRetriesPerRequestError`
 * at ~10.5 s. A readiness probe that answers in ten seconds does not report an
 * outage, it times out, and Liara's health checker learns nothing at all. A
 * PONG from a Redis that is answering is sub-millisecond, so this ceiling is
 * three orders of magnitude of headroom and cannot make a healthy store look
 * down.
 */
const PING_TIMEOUT_MS = 2_000

@Injectable()
export class RedisIndicator {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check('redis')
    let timer: NodeJS.Timeout | undefined
    try {
      // Promise.race subscribes to both, so the ping that loses is still a
      // handled rejection when ioredis finally gives up on it ten seconds
      // from now — an unhandled one would take the process down.
      await Promise.race([
        this.redis.ping(),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`redis ping timed out after ${String(PING_TIMEOUT_MS)}ms`))
          }, PING_TIMEOUT_MS)
        }),
      ])
      return indicator.up()
    } catch (error) {
      return indicator.down({ message: error instanceof Error ? error.message : 'unreachable' })
    } finally {
      clearTimeout(timer)
    }
  }
}
