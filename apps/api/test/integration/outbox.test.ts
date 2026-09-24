import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Injectable, Module } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { Db } from '../../src/infra/db/index.js'
import {
  EventPublisher,
  OnDomainEvent,
  OutboxModule,
  OutboxRelay,
  outboxEvents,
} from '../../src/infra/outbox/index.js'
import { withDb, type DbFixture } from '../setup/fixture.js'

/** Long enough to cover a local round trip several times over. */
const HANDLER_MS = 150

const seen: unknown[] = []
let failuresLeft = 0
let sideEffects = 0

@Injectable()
class SpyHandler {
  @OnDomainEvent('test.thing.happened')
  onHappened(payload: Record<string, unknown>): void {
    seen.push(payload.id)
  }

  @OnDomainEvent('test.thing.slow')
  async onSlow(payload: Record<string, unknown>): Promise<void> {
    // Slow on purpose. A handler that returns at once lets the first cycle
    // commit before the second one has even selected, which would let the
    // concurrency test below pass against a relay holding no lock at all.
    await delay(HANDLER_MS)
    seen.push(payload.id)
  }

  @OnDomainEvent('test.thing.flaky')
  onFlaky(): Promise<void> {
    // The side effect lands *before* the failure, which is the whole of
    // Review Focus 2: the relay cannot undo it, and must not compound it.
    // A rejected promise rather than a synchronous throw, because that is
    // the shape a real handler fails in.
    sideEffects += 1
    if (failuresLeft > 0) {
      failuresLeft -= 1
      return Promise.reject(new Error('handler blew up after its side effect'))
    }
    return Promise.resolve()
  }
}

// ConfigModule and DbModule come from withDb(); this is the rest of the graph
// under test — the outbox itself plus a provider carrying decorated methods
// for the relay to discover. AppModule is deliberately not booted: nothing
// here needs HTTP, and Task 16 owns wiring the relay into it.
@Module({ imports: [OutboxModule], providers: [SpyHandler] })
class TestModule {}

const AGGREGATE_ID = '0199f3c0-1111-7000-8000-000000000000'

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const anEvent = (type: string) => ({
  type,
  aggregateType: 'thing',
  aggregateId: AGGREGATE_ID,
  payload: { id: 'abc' },
  occurredAt: new Date(),
})

describe('OutboxRelay', () => {
  let fixture: DbFixture | undefined
  let db: Db
  let relay: OutboxRelay
  let publisher: EventPublisher

  /** Two idle clients in the pool, so neither concurrent call pays to open one. */
  const warmPool = (): Promise<unknown> =>
    Promise.all([db.execute(sql`select 1`), db.execute(sql`select 1`)])

  /** What an application service does: publish inside its own transaction. */
  const publish = (type: string): Promise<void> =>
    db.transaction(async (tx) => {
      await publisher.publish(anEvent(type), tx)
    })

  beforeAll(async () => {
    fixture = await withDb(TestModule)
    db = fixture.db
    relay = fixture.app.get(OutboxRelay)
    publisher = fixture.app.get(EventPublisher)
  })

  afterAll(async () => {
    await fixture?.close()
  })

  beforeEach(async () => {
    await fixture?.reset()
    seen.length = 0
    failuresLeft = 0
    sideEffects = 0
  })

  it('publishes in the same transaction as the state change', async () => {
    await expect(
      db.transaction(async (tx) => {
        await publisher.publish(anEvent('test.thing.happened'), tx)
        throw new Error('caller rolled back')
      }),
    ).rejects.toThrow('caller rolled back')

    const rows = await db.select().from(outboxEvents)
    // If the row survived, publish() opened its own transaction and the
    // outbox is no longer atomic with the write that caused it.
    expect(rows).toHaveLength(0)
  })

  it('delivers an event to its handler and marks it published', async () => {
    await publish('test.thing.happened')

    const result = await relay.runOnce()
    expect(result).toEqual({ processed: 1, failed: 0 })
    expect(seen).toEqual(['abc'])

    const [row] = await db.select().from(outboxEvents)
    expect(row?.publishedAt).not.toBeNull()
    expect(row?.attempts).toBe(0)
  })

  // An event nobody listens for is delivered, not parked: otherwise every
  // type without a handler would climb to five attempts and land in the
  // `outbox.dead` count /health/ready reports (§5.6).
  it('marks an event with no handler published rather than parking it', async () => {
    await publish('test.thing.unheard')

    expect(await relay.runOnce()).toEqual({ processed: 1, failed: 0 })
    const [row] = await db.select().from(outboxEvents)
    expect(row?.publishedAt).not.toBeNull()
    expect(row?.attempts).toBe(0)
  })

  // Review Focus 2. A relay that let the handler's rejection escape its
  // transaction would roll the increment back with it and read 0 here; one
  // that bumped attempts on selection as well as on failure would read 2.
  it('increments attempts exactly once per failed cycle and leaves it unpublished', async () => {
    failuresLeft = 1
    await publish('test.thing.flaky')

    expect(await relay.runOnce()).toEqual({ processed: 0, failed: 1 })
    let [row] = await db.select().from(outboxEvents)
    expect(row?.attempts).toBe(1)
    expect(row?.publishedAt).toBeNull()
    expect(row?.lastError).toContain('blew up')
    expect(sideEffects).toBe(1)

    // The retry re-runs the handler, so its side effect happens twice. That
    // is inherent to at-least-once delivery — handlers must be idempotent.
    expect(await relay.runOnce()).toEqual({ processed: 1, failed: 0 })
    ;[row] = await db.select().from(outboxEvents)
    expect(row?.publishedAt).not.toBeNull()
    expect(sideEffects).toBe(2)
    // Succeeding is not an attempt: the count still reads the one failure.
    expect(row?.attempts).toBe(1)
  })

  it('parks a row at five attempts and stops selecting it', async () => {
    failuresLeft = 99
    await publish('test.thing.flaky')

    for (let i = 0; i < 5; i++) await relay.runOnce()

    const [row] = await db.select().from(outboxEvents)
    expect(row?.attempts).toBe(5)
    expect(row?.publishedAt).toBeNull()

    const after = await relay.runOnce()
    expect(after).toEqual({ processed: 0, failed: 0 })
    expect(sideEffects).toBe(5)
  })

  // Review Focus 1, half one: with no lock clause at all both transactions
  // select the row, both run the handler and both mark it published, so
  // `processed` sums to 2 and `seen` holds two entries.
  //
  // Deterministic by construction rather than by luck. pg opens a connection
  // lazily and a handshake costs far more than a query, so whichever call had
  // to open one would run a whole cycle behind the other — enough for the row
  // to be published before the second looked. Measured: with the lock clause
  // deleted and neither precaution in place, this test still passed.
  it('never hands the same row to two concurrent relays', async () => {
    await publish('test.thing.slow')
    await warmPool()

    const [a, b] = await Promise.all([relay.runOnce(), relay.runOnce()])
    expect(a.processed + b.processed).toBe(1)
    expect(seen).toEqual(['abc'])
  })

  // Review Focus 1, half two. The test above passes under a plain FOR UPDATE:
  // the second transaction blocks, and when the first commits, Postgres
  // re-evaluates the predicate against the new row version, finds
  // published_at set and returns nothing. So it cannot tell SKIP LOCKED from
  // FOR UPDATE — only a lock somebody else is *holding* can.
  it('skips a row another session holds rather than blocking on it', async () => {
    await publish('test.thing.happened')

    const BLOCKED = 'blocked'
    let pending: Promise<unknown> = Promise.resolve()

    const outcome = await db.transaction(async (tx) => {
      // Exactly the window a second relay occupies between its
      // SELECT … FOR UPDATE and its COMMIT, held open deliberately so the
      // assertion is not a race.
      await tx.execute(sql`select id from outbox_events for update`)
      pending = relay.runOnce()
      // Raced rather than awaited: this transaction cannot commit until the
      // callback returns, so a relay that blocks on the lock would deadlock
      // and hang the run instead of failing it.
      return await Promise.race([
        pending,
        new Promise((resolve) => {
          // unref'd: on the passing path this timer is still pending when
          // the test ends, and it must not hold the process open.
          setTimeout(resolve, 2_000, BLOCKED).unref()
        }),
      ])
    })

    // Always awaited, so a relay that blocked does not keep running into the
    // next test once the commit above releases the lock.
    await pending.catch(() => undefined)

    expect(outcome).toEqual({ processed: 0, failed: 0 })
    expect(seen).toEqual([])
  })

  // Review Focus 5, with its premise corrected. base.json does set
  // exactOptionalPropertyTypes and outbox_events.last_error is the first
  // nullable column in the codebase — but the collision the review expects
  // does not exist in drizzle 0.45.3, measured twice: `table.d.ts:61` types
  // an optional insert key's value as `| undefined`, and
  // `pg-core/dialect.js:377-388` emits `default` both for an absent key and
  // for a Param holding `undefined`. So `{ lastError: maybeUndefined }`
  // compiles and stores NULL, there is no compile error to push an author
  // towards a coercion, and the first two lines below are the brief's own
  // assertions rather than a replacement for them.
  //
  // They are kept because they are what a coercion would break: with
  // `lastError: String(absent)` added to publish(), this fails with
  // `expected 'undefined' to be null`. The counter-row at the end pins
  // Postgres's `is null` rather than anything this system does — it is here
  // so the count is known to discriminate, and it is the weaker half.
  it('stores an absent optional as NULL, not as the string "undefined"', async () => {
    await publish('test.thing.happened')

    const [row] = await db.select().from(outboxEvents)
    expect(row?.lastError).toBeNull()
    expect(row?.publishedAt).toBeNull()

    const nulls = sql`select count(*)::int as n from outbox_events where last_error is null`
    expect((await db.execute(nulls)).rows[0]).toMatchObject({ n: 1 })

    // The mistake, made on purpose. This pins Postgres, not the outbox:
    // `String(absent)` stores the nine letters of "undefined", which `is
    // null` does not match, so the count above cannot be passing for the
    // wrong reason.
    await db.insert(outboxEvents).values({
      aggregateType: 'thing',
      aggregateId: AGGREGATE_ID,
      eventType: 'test.thing.happened',
      payload: {},
      lastError: String(undefined),
    })
    expect((await db.execute(nulls)).rows[0]).toMatchObject({ n: 1 })
  })
})
