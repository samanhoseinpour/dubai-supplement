import { Inject, Injectable } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { REDIS } from './redis.provider.js'

/**
 * The port. Modules depend on this class as a token; only redis.module.ts
 * knows which adapter satisfies it, so nothing above `infra/` names ioredis.
 */
@Injectable()
export abstract class KeyValueStore {
  abstract get(key: string): Promise<string | null>
  abstract set(key: string, value: string, ttlSeconds?: number): Promise<void>
  abstract del(key: string): Promise<void>
}

@Injectable()
export class RedisKeyValueStore extends KeyValueStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super()
  }

  /** `null` for a missing key: ioredis's own answer, passed through. */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  /**
   * Without a TTL the key is permanent. `EX` rather than a follow-up EXPIRE,
   * so a value can never outlive its expiry because the second command lost.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds === undefined) await this.redis.set(key, value)
    else await this.redis.set(key, value, 'EX', ttlSeconds)
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }
}
