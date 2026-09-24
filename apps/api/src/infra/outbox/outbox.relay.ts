import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
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
  private readonly handlers = new Map<string, Handler[]>()
  private timer: NodeJS.Timeout | undefined
  private inFlight: Promise<unknown> = Promise.resolve()
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

  /** Polls every OUTBOX_POLL_MS. Task 14 decides which roles call this. */
  start(): void {
    if (this.timer) return
    this.stopped = false
    const tick = async (): Promise<void> => {
      if (this.stopped) return
      // Held so stop() can await the cycle that is running right now. A
      // failed cycle is swallowed: the rows it did not reach are still
      // unpublished and the next tick finds them.
      this.inFlight = this.runOnce().catch(() => ({ processed: 0, failed: 0 }))
      await this.inFlight
    }
    this.timer = setInterval(() => void tick(), this.config.outboxPollMs)
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
