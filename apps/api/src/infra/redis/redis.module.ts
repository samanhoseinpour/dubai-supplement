import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { AppConfig } from '../config/index.js'
import { KeyValueStore, RedisKeyValueStore } from './key-value.store.js'
import { createRedis, REDIS } from './redis.provider.js'

/**
 * How long `quit()` gets to drain before the client is ended regardless.
 *
 * Measured against the suite's own container: a healthy `quit()` costs p50
 * 0.201 ms idle and p50 0.304 ms / max 2.313 ms with ten commands still in
 * flight, so a second is ~430x the worst real drain and cannot truncate one.
 * What it bounds is the other case — see `RedisCloser` below.
 *
 * A shutdown-scoped bound rather than a smaller `maxRetriesPerRequest`: that
 * option governs every request, and `infra/health/probe-timeout.ts` records
 * its 2 s Redis ceiling *against* the ~10.5 s a request takes to give up, so
 * shortening it would silently rewrite a rationale held somewhere else. The
 * defect is in shutdown; the fix belongs there.
 *
 * Sized against the grace period it exists to fit inside: Docker's and
 * Liara's SIGTERM grace is commonly 10 s, and the rest of that belongs to the
 * relay's in-flight cycle (§5.2) and to `pool.end()`, which drain work this
 * process actually owns. A dead socket gets a tenth of it.
 */
export const REDIS_QUIT_TIMEOUT_MS = 1_000

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

    // So quit() goes first and gets REDIS_QUIT_TIMEOUT_MS, and the client is
    // ended either way. Why the bound exists, measured against ioredis 5.11.1
    // with the suite's own Redis taken away mid-life:
    //
    //  - offline queue EMPTY — quit() short-circuits to disconnect() and
    //    resolves 'OK' in ~10 ms (ioredis Redis.js:379). Nothing to bound.
    //  - offline queue NON-EMPTY, which is what any command still in flight
    //    when Redis went away leaves behind — quit() is queued behind it and
    //    waits out `maxRetriesPerRequest: 20`, whose default retry schedule
    //    sums to 10 500 ms, and then *rejects* with MaxRetriesPerRequestError.
    //    Measured at 10 201 / 10 208 / 10 519 ms. Nest 12 runs shutdown hooks
    //    through `Promise.allSettled` and merely logs a rejection, so
    //    `app.close()` still resolved — but because quit() rejected, the
    //    client was never ended: it went on reconnecting, and the process was
    //    still alive eight seconds after close() returned, held open by
    //    nothing but that reconnect timer.
    //
    // A SIGTERM during a Redis outage therefore both overran the 10 s grace
    // Docker and Liara commonly allow *and* left a process that would not
    // exit. This bounds the first and the disconnect() below ends the second.
    let expiry: NodeJS.Timeout | undefined
    await Promise.race([
      // Swallowed, and it has to be: the only thing this rejection can say is
      // that a Redis we are about to disconnect from could not be reached,
      // and left unhandled it would surface after the process has finished
      // shutting down, with nothing left to catch it.
      this.redis.quit().catch(() => undefined),
      new Promise<void>((resolve) => {
        expiry = setTimeout(resolve, REDIS_QUIT_TIMEOUT_MS)
      }),
    ])
    clearTimeout(expiry)
    // Unconditional. A resolved quit() does not mean the socket is gone —
    // ioredis reaches 'end' on the stream's own close event, a tick later —
    // and disconnect() on a client that is already finished is a no-op. What
    // it is here for is the other branch: a quit() that lost the race, whose
    // client would otherwise reconnect for as long as the outage lasts.
    this.redis.disconnect()
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
