import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { AppConfig } from '../config/index.js'
import { KeyValueStore, RedisKeyValueStore } from './key-value.store.js'
import { createRedis, REDIS } from './redis.provider.js'

/**
 * The client this module built, closed with the application — the counterpart
 * of db/db.module.ts's PoolCloser. Before this module existed the throttler
 * constructed its own client inside app.module.ts's factory and nothing ever
 * closed it, so a SIGTERM left a live socket holding the event loop open.
 */
@Injectable()
class RedisCloser implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    // quit() drains what is in flight; disconnect() would drop it. On a
    // lazyConnect client that never ran a command it still resolves 'OK' in
    // under a millisecond and leaves no open handle — measured against a
    // closed port — so `pnpm --filter api openapi` still closes cleanly with
    // no Redis anywhere (§5.5). Only an already-ended client would reject
    // with "Connection is closed", and nothing else ends this one:
    // @nest-lab/throttler-storage-redis disconnects a client it constructed
    // itself, never one handed to its constructor.
    if (this.redis.status === 'end') return
    await this.redis.quit()
  }
}

/**
 * One shared Redis connection and the KeyValueStore over it.
 *
 * @Global() decides who may inject REDIS and KeyValueStore, not whether the
 * module is built: one import into the root graph is still what instantiates
 * it. Nothing connects here — the client is lazy (§5.5).
 */
@Global()
@Module({
  providers: [
    { provide: REDIS, inject: [AppConfig], useFactory: (config: AppConfig) => createRedis(config) },
    { provide: KeyValueStore, useClass: RedisKeyValueStore },
    RedisCloser,
  ],
  exports: [REDIS, KeyValueStore],
})
export class RedisModule {}
