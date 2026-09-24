import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { eq } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { AppModule } from '../../src/app.module.js'
import { AppConfig, EnvSchema, validatedEnv } from '../../src/infra/config/index.js'
import { DRIZZLE, type Db } from '../../src/infra/db/index.js'
import {
  EventPublisher,
  OutboxRelay,
  outboxEvents,
  type RelayCycle,
} from '../../src/infra/outbox/index.js'
import { REDIS, REDIS_QUIT_TIMEOUT_MS } from '../../src/infra/redis/index.js'
import { withDb, type DbFixture } from '../setup/fixture.js'

/**
 * §5.2: `api` serves HTTP, `all` serves HTTP and runs the relay in the same
 * container, `worker` runs the relay with no HTTP server — and a SIGTERM must
 * end all three inside the container runtime's grace period.
 *
 * The role is carried by the *bootstrap*, not by the module graph: AppModule
 * is identical under all three, which is why `bootstrapWorker` gets a test of
 * its own and why `bootWith(role)` below asserts nothing about the variable
 * beyond setting it for the config the app is built from.
 */

/** Shortest poll the schema allows, so a real loop can be watched without waiting. */
const FAST_POLL_MS = '50'

/**
 * How long a `close()` that is *not* awaiting the relay is given to prove it.
 * There is no way to assert a promise never settles, only that it has not
 * settled yet; a shutdown that skips the relay resolves in single-digit
 * milliseconds (measured), so this is two orders of magnitude of headroom and
 * it is bounded, which is what `.claude/rules/testing.md` asks of a wait.
 */
const STILL_PENDING_MS = 500

/**
 * The whole of `app.close()`, against a Redis that has gone away.
 *
 * Docker's and Liara's SIGTERM grace is commonly 10 s. This is a third of it,
 * leaving the rest to the relay's in-flight cycle and the pool — the parts
 * whose duration is the application's own work rather than a dead socket's.
 * Measured against the code this test was written for: 10 201 ms.
 */
const SHUTDOWN_BUDGET_MS = 3_000

/** A worker's loop must deliver within a few poll periods of a 1 s default. */
const WORKER_DELIVERY_MS = 15_000

/**
 * How long a shut-down Redis client is watched for a reconnect it must not
 * attempt. ioredis's retry delay is `min(attempt * 50, 2000)` ms, so this is
 * longer than its cap and several attempts' worth at the point `close()`
 * returns here.
 */
const QUIET_AFTER_CLOSE_MS = 3_000

/** The spawned entrypoint's own poll, so a started relay is seen at once. */
const CHILD_POLL_MS = 50

/** Boot budget for a spawned entrypoint: connect a pool, a client, listen. */
const CHILD_BOOT_MS = 30_000

/** Many poll periods, so a started relay could not have missed the row. */
const CHILD_DELIVERY_MS = 10_000

/**
 * And the silence the other way. Forty `CHILD_POLL_MS` periods: a relay that
 * was running would have taken the row dozens of times over.
 */
const CHILD_SILENCE_MS = 2_000

/**
 * How long a spawned entrypoint gets to honour SIGTERM before it is killed.
 *
 * SIGTERM is a request, not a guarantee: a shutdown hook that never resolves
 * leaves Nest's signal handler awaiting `app.close()` and the process alive
 * forever — the hazard recorded beside `RedisCloser`'s `disconnect()`, and
 * reproducible by injecting it. Without an escalation the harness inherits
 * that hang: the test dies on vitest's own 60 s timeout inside `finally`, the
 * cleanup after `stop()` never runs, and the child outlives the whole run
 * holding its port, where it presents later as an unrelated failure.
 *
 * Five seconds because a graceful exit is nothing like that: 22 ms and 28 ms
 * measured on the real entrypoint, and the slowest leg of shutdown is now
 * bounded at `REDIS_QUIT_TIMEOUT_MS`. A child still alive after this is
 * wedged, not slow — and `stop()` says which happened rather than hiding it.
 */
const CHILD_TERM_MS = 5_000

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * A condition wait, not a sleep: resolves as soon as `predicate` holds and
 * reports whether it ever did. Used in both directions — `true` for "this
 * happened", `false` for "this had not happened yet", which is the only
 * honest form the pending-promise assertions below can take.
 */
async function within(ms: number, predicate: () => boolean | Promise<boolean>): Promise<boolean> {
  const deadline = Date.now() + ms
  for (;;) {
    if (await predicate()) return true
    if (Date.now() >= deadline) return false
    await delay(5)
  }
}

/**
 * A cycle whose end this file decides, and which records that it ended.
 *
 * `finish` is idempotent so that a teardown can call it unconditionally: a
 * failed assertion must not leave `stop()` waiting on a cycle that will never
 * end, which turns a legible failure into a test timeout.
 */
function deferredCycle(order: string[]): { promise: Promise<RelayCycle>; finish: () => void } {
  let finish = (): void => undefined
  const promise = new Promise<RelayCycle>((resolve) => {
    let finished = false
    finish = () => {
      if (finished) return
      finished = true
      order.push('cycle')
      resolve({ processed: 0, failed: 0 })
    }
  })
  return { promise, finish }
}

let app: NestFastifyApplication | undefined

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await app?.close()
  app = undefined
})

/**
 * The production graph, booted the way `createApp` boots it minus the parts
 * that need a socket. `overrides` go through the same `AppConfig` seam
 * `test/integration/db.test.ts` uses, so the app under test reads them from
 * the container it was given rather than from the file's own process.env.
 */
async function bootWith(
  role: string,
  overrides: Readonly<Record<string, string>> = {},
): Promise<NestFastifyApplication> {
  process.env.PROCESS_ROLE = role
  const builder = Test.createTestingModule({ imports: [AppModule] })
  if (Object.keys(overrides).length > 0) {
    builder
      .overrideProvider(AppConfig)
      .useValue(new AppConfig(EnvSchema.parse({ ...process.env, ...overrides })))
  }
  const moduleRef = await builder.compile()
  const built = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )
  built.enableShutdownHooks()
  await built.init()
  return built
}

describe('PROCESS_ROLE', () => {
  it('serves HTTP under api', async () => {
    app = await bootWith('api')
    const res = await app.inject({ method: 'GET', url: '/health/live' })
    expect(res.statusCode).toBe(200)
  })

  // (a) A relay that only raises its `stopped` flag still stops delivering —
  // the flag is checked first thing in the tick — so no amount of watching the
  // database can tell it from a relay that cleared its interval. The symptom
  // is a container that will not exit on SIGTERM, and the interval itself is
  // the only place it is visible.
  it('(a) stop() clears the poll interval rather than only raising its stopped flag', async () => {
    app = await bootWith('all')
    const relay = app.get(OutboxRelay)

    // Only the interval verbs are faked. The app under this test holds a live
    // pg pool and a live ioredis client, and both schedule real timeouts;
    // freezing `setTimeout` for the length of the test would freeze them too.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const idle = vi.getTimerCount()

    relay.start()
    expect(vi.getTimerCount()).toBe(idle + 1)

    await relay.stop()
    expect(vi.getTimerCount()).toBe(idle)
  })

  // (b) "SIGTERM must not cut a cycle in half" is a statement about when
  // stop() RESOLVES, and nothing else in the suite says it: a stop() that
  // clears the interval and returns at once is indistinguishable from a
  // correct one by timer count, by database state, and by every assertion
  // Task 13 wrote. The cycle is stubbed so this file owns when it ends.
  it('(b) stop() resolves only after the cycle already in flight has finished', async () => {
    app = await bootWith('all')
    const relay = app.get(OutboxRelay)
    const order: string[] = []
    const cycle = deferredCycle(order)
    const runOnce = vi.spyOn(relay, 'runOnce').mockReturnValue(cycle.promise)

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const pollMs = app.get(AppConfig).outboxPollMs
    relay.start()
    await vi.advanceTimersByTimeAsync(pollMs)
    expect(runOnce).toHaveBeenCalledTimes(1)

    const stopping = relay.stop().then(() => {
      order.push('stop')
    })
    // Virtual time, so twenty poll periods cost nothing. stop() has had every
    // chance to settle and must not have taken it.
    await vi.advanceTimersByTimeAsync(20 * pollMs)
    expect(order).toEqual([])

    cycle.finish()
    await stopping
    expect(order).toEqual(['cycle', 'stop'])
  })

  // (c) And the shutdown hook has to await that stop() rather than merely
  // firing it: `void this.stop()` would leave the container free to exit
  // mid-cycle while every assertion above still passed.
  it("(c) close() awaits the relay's stop rather than resolving alongside it", async () => {
    const built = await bootWith('all', { OUTBOX_POLL_MS: FAST_POLL_MS })
    app = built
    const relay = built.get(OutboxRelay)
    const order: string[] = []
    const cycle = deferredCycle(order)
    const runOnce = vi.spyOn(relay, 'runOnce').mockReturnValue(cycle.promise)

    // Real timers here: close() ends a real pool and a real Redis client, and
    // virtual time would never let that work finish.
    relay.start()
    expect(await within(STILL_PENDING_MS, () => runOnce.mock.calls.length === 1)).toBe(true)

    try {
      const closing = built.close().then(() => {
        order.push('close')
      })
      // This file owns the close from here; afterEach must not repeat it,
      // because pg rejects a second pool.end().
      app = undefined

      expect(await within(STILL_PENDING_MS, () => order.length > 0)).toBe(false)

      cycle.finish()
      await closing
      expect(order).toEqual(['cycle', 'close'])
    } finally {
      // A close() that never stopped the relay leaves its interval running
      // past the end of this test — and stop() would then wait on a cycle no
      // assertion is left to end.
      cycle.finish()
      await relay.stop()
    }
  })

  it('is safe to stop a relay that was never started', async () => {
    app = await bootWith('worker')
    await expect(app.get(OutboxRelay).stop()).resolves.toBeUndefined()
  })

  it('runs the relay with no HTTP server under bootstrapWorker', async () => {
    // Imported here, and only with PROCESS_ROLE set to something else:
    // worker.ts's entrypoint guard runs at module evaluation, so a static
    // import would boot a second application context that no test closes.
    // The guard decides whether `node dist/worker.js` is an entrypoint; it
    // decides nothing about what bootstrapWorker() does.
    process.env.PROCESS_ROLE = 'api'
    const { bootstrapWorker } = await import('../../src/worker.js')
    process.env.PROCESS_ROLE = 'worker'

    const context = await bootstrapWorker()
    try {
      // createApplicationContext, not create(): there is no server, so there
      // is nothing to listen on and nothing to inject into.
      expect(context).not.toHaveProperty('listen')
      expect(context).not.toHaveProperty('getHttpServer')

      // Evidence that the loop is running, not merely that the relay is
      // resolvable: this row is published by the poll the worker started,
      // with no runOnce() call from the test.
      const db = context.get<Db>(DRIZZLE)
      const aggregateId = randomUUID()
      await db.transaction(async (tx) => {
        await context.get(EventPublisher).publish(
          {
            type: 'test.worker.booted',
            aggregateType: 'worker',
            aggregateId,
            payload: { id: aggregateId },
            occurredAt: new Date(),
          },
          tx,
        )
      })

      const published = await within(WORKER_DELIVERY_MS, async () => {
        const [row] = await db
          .select()
          .from(outboxEvents)
          .where(eq(outboxEvents.aggregateId, aggregateId))
        return row !== undefined && row.publishedAt !== null
      })
      expect(published).toBe(true)
    } finally {
      await context.close()
    }
  })
})

/**
 * What a container actually runs, compiled rather than through tsx.
 *
 * Not a preference: `main.ts` boots the Nest graph, and Nest resolves a
 * constructor dependency declared by class from `design:paramtypes`, which
 * tsx's esbuild transform does not emit. Measured — `tsx src/main.ts` dies at
 * the first such provider with `TypeError: Cannot read properties of
 * undefined (reading 's3')` inside `S3StorageProvider`, having injected
 * `undefined` for its AppConfig. `src/migrate.test.ts` may use tsx because
 * `migrate.ts` creates no Nest context at all (§4.2);
 * `test/integration/migrate-lock.test.ts` runs the migrator from `dist/` for
 * the same "this is the deploy's code path" reason this file does.
 *
 * `api#test:integration` declares `dependsOn: ["build"]` — its own package's
 * build, not just `^build` — and `test/setup/containers.ts` refuses to start
 * anything when the file is missing, so this cannot degrade into a test that
 * silently passes because nobody built.
 */
const mainEntrypoint = fileURLToPath(new URL('../../dist/main.js', import.meta.url))
const apiRoot = fileURLToPath(new URL('../../', import.meta.url))

/** A port nothing holds. Claimed and released, so the child may take it. */
async function freePort(): Promise<number> {
  const probe = net.createServer()
  await new Promise<void>((resolve) => {
    probe.listen(0, '127.0.0.1', resolve)
  })
  const address = probe.address()
  if (address === null || typeof address === 'string') {
    throw new Error('expected a TCP address from the port probe')
  }
  const { port } = address
  await new Promise<void>((resolve) => {
    probe.close(() => {
      resolve()
    })
  })
  return port
}

/**
 * Every key the schema knows, so the developer's `apps/api/.env` decides
 * nothing — the argument `src/migrate.test.ts` makes for the same reason. The
 * store URLs come from the validated snapshot rather than raw `process.env`,
 * which is what makes them the suite's own containers by construction.
 */
function childEnv(role: string, port: number): NodeJS.ProcessEnv {
  const env = validatedEnv()
  return {
    ...process.env,
    NODE_ENV: 'test',
    PROCESS_ROLE: role,
    PORT: String(port),
    LOG_LEVEL: 'fatal',
    DATABASE_URL: env.DATABASE_URL,
    DATABASE_POOL_MAX: '5',
    REDIS_URL: env.REDIS_URL,
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_REGION: env.S3_REGION,
    S3_BUCKET: env.S3_BUCKET,
    S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE: 'true',
    CORS_ORIGINS: '',
    TRUST_PROXY: 'loopback,uniquelocal',
    OUTBOX_POLL_MS: String(CHILD_POLL_MS),
    OPENAPI_UI_ENABLED: 'false',
  }
}

interface Entrypoint {
  readonly port: number
  /**
   * Always ends the child and always returns, saying which it took. Callers
   * put this in a `finally`, so it must not be the thing that hangs.
   */
  stop: () => Promise<'terminated' | 'killed'>
}

/**
 * `node dist/main.js` under a role, up and answering. Returning only once
 * `/health/live` is 200 is what makes the negative test below mean something:
 * the row it finds unpublished was passed over by a process that was
 * demonstrably running, not by one that never started.
 */
async function startMain(role: string): Promise<Entrypoint> {
  const port = await freePort()
  const child = spawn(process.execPath, [mainEntrypoint], {
    cwd: apiRoot,
    env: childEnv(role, port),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString()
  })
  let gone = false
  const exited = new Promise<void>((resolve) => {
    child.on('exit', () => {
      gone = true
      resolve()
    })
  })

  const live = await within(CHILD_BOOT_MS, async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${String(port)}/health/live`)
      return res.status === 200
    } catch {
      // Not up yet — or never will be, which the deadline decides.
      return false
    }
  })
  if (!live) {
    child.kill('SIGKILL')
    await exited
    throw new Error(
      `PROCESS_ROLE=${role} never answered /health/live on port ${String(port)}:\n${output}`,
    )
  }

  return {
    port,
    stop: async () => {
      child.kill('SIGTERM')
      if (await within(CHILD_TERM_MS, () => gone)) return 'terminated'
      // SIGKILL cannot be handled, so this is the branch that guarantees both
      // halves of the contract: the child dies and this returns.
      child.kill('SIGKILL')
      await exited
      return 'killed'
    },
  }
}

/**
 * The half of §5.2 that lives in `main.ts`, which no in-process test can
 * reach: `bootstrap()` is not exported and listens at import. Deleting the
 * role switch leaves the whole suite green; inverting it — so an `api`
 * container becomes a second outbox consumer and `all` publishes nothing —
 * passes lint and tsc too. Only running the entrypoint sees either.
 */
describe('PROCESS_ROLE in the compiled entrypoint', () => {
  let fixture: DbFixture
  let db: Db

  beforeAll(async () => {
    fixture = await withDb()
    db = fixture.db
  })

  afterAll(async () => {
    await fixture.close()
  })

  /** One unpublished row, under an aggregate id nothing else uses. */
  async function seedEvent(): Promise<string> {
    const aggregateId = randomUUID()
    await db.insert(outboxEvents).values({
      aggregateType: 'process-role',
      aggregateId,
      eventType: 'test.entrypoint.booted',
      payload: { id: aggregateId },
      occurredAt: new Date(),
    })
    return aggregateId
  }

  const published = (aggregateId: string) => async (): Promise<boolean> => {
    const [row] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, aggregateId))
    return row !== undefined && row.publishedAt !== null
  }

  /**
   * One seeded row and one running entrypoint, each cleaned up whichever of
   * them fails. Seeding inside the outer `try` is the point: a `startMain`
   * that throws used to kill the child and leave the row in the table.
   */
  async function withEntrypoint(
    role: string,
    body: (main: Entrypoint, aggregateId: string) => Promise<void>,
  ): Promise<void> {
    const aggregateId = await seedEvent()
    try {
      const main = await startMain(role)
      try {
        await body(main, aggregateId)
      } finally {
        await main.stop()
      }
    } finally {
      await db.delete(outboxEvents).where(eq(outboxEvents.aggregateId, aggregateId))
    }
  }

  it('runs the relay inside the HTTP app under all', async () => {
    await withEntrypoint('all', async (_main, aggregateId) => {
      expect(await within(CHILD_DELIVERY_MS, published(aggregateId))).toBe(true)
    })
  })

  it('serves HTTP and leaves the relay stopped under api', async () => {
    await withEntrypoint('api', async (main, aggregateId) => {
      expect(await within(CHILD_SILENCE_MS, published(aggregateId))).toBe(false)
      // And it is a live server that declined the row, not a dead one.
      const res = await fetch(`http://127.0.0.1:${String(main.port)}/health/live`)
      expect(res.status).toBe(200)
    })
  })

  // §5.2 asks that SIGTERM drain rather than cut, and everything above is
  // written to survive an entrypoint that ignores it — `stop()` escalates to
  // SIGKILL so a wedged child cannot leak past the run. That escalation must
  // not also be able to hide the regression, so this is the one place it is
  // read: a shutdown hook that never resolves reads 'killed' here instead of
  // quietly costing every other test five seconds.
  it('honours SIGTERM rather than having to be killed', async () => {
    const main = await startMain('all')
    // No cleanup needed on failure: stop() has already ended the child either
    // way, which is exactly what is being asserted.
    expect(await main.stop()).toBe('terminated')
  })
})

/**
 * A TCP hop in front of the suite's Redis, so it can be taken away without
 * stopping a container every other file shares. Killing it refuses every
 * reconnect, which is what a Redis outage looks like to ioredis.
 */
async function proxyToRedis(target: string): Promise<{ url: string; kill: () => Promise<void> }> {
  const upstream = new URL(target)
  const sockets = new Set<net.Socket>()
  const server = net.createServer((client) => {
    sockets.add(client)
    const server_ = net.connect({
      host: upstream.hostname,
      port: Number(upstream.port === '' ? '6379' : upstream.port),
    })
    sockets.add(server_)
    client.pipe(server_)
    server_.pipe(client)
    const drop = (): void => {
      client.destroy()
      server_.destroy()
    }
    client.on('error', drop)
    server_.on('error', drop)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('the Redis proxy did not bind a TCP port')
  }
  let killed = false
  return {
    url: `redis://127.0.0.1:${String(address.port)}${upstream.pathname}`,
    kill: async () => {
      if (killed) return
      killed = true
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      })
    },
  }
}

describe('shutdown while Redis is away', () => {
  // The other half of the line below: a warning that fired on every shutdown
  // would make the assertion in the outage test vacuous, and it would cry
  // wolf on every ordinary deploy.
  it('says nothing when Redis drains normally', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const built = await bootWith('all')
    app = undefined
    // A command actually in flight, so there is something to drain.
    await built.get<Redis>(REDIS).ping()
    await built.close()
    expect(warn).not.toHaveBeenCalled()
  })

  it('ends the client and completes well inside the SIGTERM grace period', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const proxy = await proxyToRedis(validatedEnv().REDIS_URL)
    const built = await bootWith('all', { REDIS_URL: proxy.url })
    app = built
    try {
      const redis = built.get<Redis>(REDIS)
      // ioredis emits one 'error' per failed reconnect, and prints them
      // itself when nothing listens. Counting them both keeps the suite's
      // output readable and gives the assertion after close() its evidence.
      let reconnectAttempts = 0
      redis.on('error', () => {
        reconnectAttempts += 1
      })
      await redis.ping()

      await proxy.kill()
      expect(await within(5_000, () => redis.status === 'reconnecting')).toBe(true)

      // The state that reproduces it, and the state any in-flight request
      // leaves behind: one command waiting in the offline queue. With an
      // EMPTY queue ioredis short-circuits quit() to disconnect() and
      // resolves 'OK' at once (Redis.js:379) — so a test that skipped this
      // line would pass against the very code it was written to fail.
      let queuedSettled = false
      const settle = (): void => {
        queuedSettled = true
      }
      // Not awaited anywhere: disconnect() drops what quit() could not drain,
      // and a dropped command's promise is not guaranteed to settle at all.
      void redis.get('a-key-an-in-flight-request-wanted').then(settle, settle)
      expect(await within(50, () => queuedSettled)).toBe(false)

      const started = Date.now()
      await built.close()
      app = undefined
      const elapsed = Date.now() - started

      expect(elapsed).toBeLessThan(SHUTDOWN_BUDGET_MS)
      // And the Redis leg is what the budget was spent on, at the bound this
      // module declares rather than at some accident of the retry schedule.
      expect(elapsed).toBeLessThan(REDIS_QUIT_TIMEOUT_MS * 2)

      // Evidence the client was ended rather than merely left behind: a
      // client still reconnecting emits an error every retry delay — a few
      // hundred milliseconds at this point in ioredis's schedule, 2 s at its
      // cap — and holds that timer on the event loop for as long as the
      // outage lasts, so the process outlives its own shutdown and only
      // SIGKILL ends it. `status` is deliberately not the signal: disconnect()
      // on a client caught between attempts clears the reconnect timer
      // without producing a stream close, so it reads 'reconnecting' while
      // being inert. Measured out of process: with this window quiet the
      // process exits on its own ~2 s later; without the disconnect it was
      // still alive eight seconds after close() returned.
      const attemptsAtClose = reconnectAttempts
      expect(await within(QUIET_AFTER_CLOSE_MS, () => reconnectAttempts > attemptsAtClose)).toBe(
        false,
      )

      // And it said so. Dropping what could not be drained is the whole point
      // of the bound, and this line is the only record that it happened —
      // before the bound existed, Nest's own Promise.allSettled logged the
      // rejected hook. The timeout branch is the one asserted because it is
      // the one that can be relied on to arrive: the quit() it gave up on
      // never settles afterwards.
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('redis did not drain within') as string,
        }),
      )
    } finally {
      await proxy.kill()
    }
  })
})
