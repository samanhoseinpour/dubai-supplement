import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common'
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { and, asc, eq, isNull, lt } from 'drizzle-orm'
import { AppConfig } from '../config/index.js'
import { DRIZZLE, type Db } from '../db/index.js'
import { ON_DOMAIN_EVENT } from './on-domain-event.decorator.js'
import { outboxEvents } from './schema.js'

/** A row that has failed this many times is parked, not retried (§5.6). */
export const MAX_ATTEMPTS = 5
export const BATCH_SIZE = 50

type Handler = (payload: Record<string, unknown>) => Promise<void> | void

export interface RelayCycle {
  processed: number
  failed: number
}

@Injectable()
export class OutboxRelay implements OnModuleInit, OnApplicationShutdown {
  // Writes through whatever `app.useLogger` installed — pino, in `createApp`
  // — exactly as ProblemFilter does.
  private readonly logger = new Logger(OutboxRelay.name)
  private readonly handlers = new Map<string, Handler[]>()
  private timer: NodeJS.Timeout | undefined
  private inFlight: Promise<unknown> = Promise.resolve()
  private running = false
  private stopped = false

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly config: AppConfig,
  ) {}

  /**
   * Handlers are found once, at startup: every `@OnDomainEvent` method on
   * every provider Nest has instantiated. Nothing subscribes later, so the
   * map is fixed for the life of the process.
   */
  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance
      // A provider Nest never instantiated (request-scoped, or one whose
      // module was not built) has no instance to scan.
      if (instance === null || typeof instance !== 'object') continue
      const prototype = Object.getPrototypeOf(instance) as object | null

      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const method: unknown = (instance as Record<string, unknown>)[name]
        if (typeof method !== 'function') continue
        // Typed as possibly absent because it is: Reflector.get declares
        // whatever it is asked for, and most methods carry no metadata.
        const type = this.reflector.get<string | undefined>(ON_DOMAIN_EVENT, method)
        if (type === undefined) continue

        const handler = method as Handler
        const list = this.handlers.get(type) ?? []
        list.push((payload) => handler.call(instance, payload))
        this.handlers.set(type, list)
      }
    }
  }

  /**
   * One cycle: one transaction, one batch.
   *
   * The whole batch is processed inside the transaction that locked it, so a
   * row is marked published — or its failure recorded — on the same
   * connection that holds its lock. Selecting in one transaction and
   * processing in another would release every lock at the first commit, and
   * a second relay would take the same rows while the first still held them
   * in memory.
   */
  runOnce(): Promise<RelayCycle> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(outboxEvents)
        .where(and(isNull(outboxEvents.publishedAt), lt(outboxEvents.attempts, MAX_ATTEMPTS)))
        .orderBy(asc(outboxEvents.id))
        .limit(BATCH_SIZE)
        // Two relays run concurrently under PROCESS_ROLE=all plus a worker.
        // SKIP LOCKED is what keeps them off each other's rows: without it
        // the second blocks until the first commits its entire batch, and
        // without any lock at all both deliver every row.
        .for('update', { skipLocked: true })

      let processed = 0
      let failed = 0

      for (const row of rows) {
        // An event nobody listens for is delivered, not parked: otherwise
        // every unhandled type would climb to MAX_ATTEMPTS and land in the
        // `outbox.dead` count /health/ready is to report (§5.6).
        const handlers = this.handlers.get(row.eventType) ?? []
        try {
          for (const handler of handlers) {
            await handler(row.payload)
          }
          await tx
            .update(outboxEvents)
            .set({ publishedAt: new Date() })
            .where(eq(outboxEvents.id, row.id))
          processed += 1
        } catch (error) {
          // Caught here rather than at the transaction boundary, so the
          // increment commits with everything else this cycle did. Exactly
          // one increment per failed cycle: the row is retried on a later
          // poll, and a handler that failed after a side effect must not be
          // charged twice for one failure.
          await tx
            .update(outboxEvents)
            .set({
              attempts: row.attempts + 1,
              lastError:
                error instanceof Error
                  ? error.message
                  : // Not `String(error)`: a rejection carrying `undefined`
                    // would store the nine letters of "undefined", which read
                    // as a value that was lost rather than as a handler that
                    // failed with nothing to say. `only-throw-error` and
                    // `prefer-promise-reject-errors` keep every handler in
                    // this repository on the branch above, so this one only
                    // has to stay readable.
                    `handler rejected with a non-Error value of type ${typeof error}`,
            })
            .where(eq(outboxEvents.id, row.id))
          failed += 1
        }
      }

      return { processed, failed }
    })
  }

  /**
   * Polls every OUTBOX_POLL_MS. Task 16 decides which roles call this.
   *
   * The announcement is not decoration: AppModule is identical under every
   * PROCESS_ROLE, so a container that serves HTTP and relays nothing boots to
   * a byte-identical log. This line is the only thing that tells the two
   * apart, and `docs/runbooks/first-deploy.md` §4 — the one check against
   * events accumulating in `outbox_events` while nothing reacts — is that
   * comparison. Logged after the interval exists, so it reports a fact, and
   * below the idempotence guard, so a second start() does not announce a
   * relay it did not start.
   */
  start(): void {
    if (this.timer) return
    this.stopped = false
    const tick = async (): Promise<void> => {
      // One cycle at a time. A batch of fifty holds its connection for the
      // sum of its handlers' latencies, which can outlast the interval, and a
      // tick landing on top of an unfinished cycle would take a second pooled
      // connection to find nothing (SKIP LOCKED leaves it the rows the first
      // is still holding). It also keeps `inFlight` the cycle stop() must
      // wait for rather than the newest of several — without which the
      // comment in stop() would be a stronger claim than the code.
      if (this.stopped || this.running) return
      this.running = true
      this.inFlight = this.cycle()
      await this.inFlight
    }
    this.timer = setInterval(() => void tick(), this.config.outboxPollMs)
    this.logger.log({ msg: 'outbox relay started', pollMs: this.config.outboxPollMs })
  }

  /**
   * One polled cycle, and the only place a relay failure is ever recorded.
   *
   * A failure at the transaction level — the pool ended, the connection lost,
   * a permission revoked — reaches none of the per-row catches in runOnce():
   * `attempts` never moves, so the rows stay unpublished at zero attempts,
   * invisible to the `outbox.dead` readiness count, which sees parked rows
   * only. This line is the sole symptom, so it must exist.
   *
   * `{ err }` in one object rather than `error('…', err)`: Nest appends its
   * context as the last argument, and nestjs-pino reads a string message's
   * remaining params as pino interpolation arguments — an Error passed that
   * way is dropped. This is the shape ProblemFilter uses.
   */
  private async cycle(): Promise<void> {
    try {
      await this.runOnce()
    } catch (error: unknown) {
      this.logger.error({ err: error, msg: 'outbox cycle failed' })
    } finally {
      this.running = false
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    clearInterval(this.timer)
    this.timer = undefined
    // SIGTERM must not cut a cycle in half (§5.2).
    await this.inFlight
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop()
  }
}
