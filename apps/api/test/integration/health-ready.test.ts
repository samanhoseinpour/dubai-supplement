import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import type { Redis } from 'ioredis'
import type { Pool } from 'pg'
import { Logger, PARAMS_PROVIDER_TOKEN, type Params } from 'nestjs-pino'
import { AppModule } from '../../src/app.module.js'
import { AppConfig, EnvSchema } from '../../src/infra/config/index.js'
import { DRIZZLE, PG_POOL, type Db } from '../../src/infra/db/index.js'
import { ProblemFilter } from '../../src/infra/http/index.js'
import { buildLoggerOptions } from '../../src/infra/logger/index.js'
import { MAX_ATTEMPTS, outboxEvents } from '../../src/infra/outbox/index.js'
import { REDIS } from '../../src/infra/redis/index.js'
import { truncateAll } from '../setup/truncate.js'

/**
 * Nothing listens on port 1. A store moved here is unreachable in the way
 * that matters — a real client, a real socket, a real refusal — while the
 * containers the rest of the suite shares stay up.
 */
const UNREACHABLE_POSTGRES = 'postgres://dubaisupp:dubaisupp@127.0.0.1:1/dubaisupp'
const UNREACHABLE_REDIS = 'redis://127.0.0.1:1/0'

/** Terminus's own body, as far as this file reads it. */
interface HealthBody {
  readonly status: string
  readonly info: Readonly<Record<string, { status: string }>>
  readonly error: Readonly<Record<string, { status: string }>>
  readonly details: Readonly<Record<string, { status: string; dead?: number; message?: string }>>
}

/** What `app.inject()` resolves to, as far as this file reads it. */
interface Injected {
  readonly statusCode: number
  readonly headers: Readonly<Record<string, unknown>>
  readonly payload: string
}

function health(res: Injected): HealthBody {
  return JSON.parse(res.payload) as HealthBody
}

/**
 * The container environment with a store moved somewhere closed. Built from
 * `process.env`, which the global setup filled, so only the named key differs
 * from what every other file runs against.
 *
 * LOG_LEVEL is forced to `error`: the suite runs at `fatal`, and the lines
 * this file asserts on — the ones a readiness 503 must not write — are error
 * lines. `buildLoggerOptions` takes the level from here.
 */
function configWith(overrides: Readonly<Record<string, string>>): AppConfig {
  return new AppConfig(EnvSchema.parse({ ...process.env, LOG_LEVEL: 'error', ...overrides }))
}

/**
 * Every line pino wrote, for the whole file.
 *
 * Module-scoped rather than one array per suite because nestjs-pino builds
 * exactly one pino-http instance per module graph (`rootLogger.ts`'s
 * `ensureRootLogger`, a module-level singleton) — whichever app boots first
 * fixes the destination, and a second array would silently stay empty while
 * its assertions passed. Measured: a per-suite array captured nothing at all
 * for the second and third apps, including a 500 that demonstrably logged.
 */
const lines: string[] = []

/**
 * The production options at `error` level paired with a capturing stream,
 * through the provider token LoggerModule's own factory fills.
 */
function capturingParams(config: AppConfig): Params {
  const options = buildLoggerOptions(config).pinoHttp
  if (options === undefined || Array.isArray(options) || 'write' in options) {
    throw new Error('expected buildLoggerOptions to return a pino-http options object')
  }
  return {
    pinoHttp: [
      options,
      {
        write: (msg: string) => {
          lines.push(msg)
        },
      },
    ],
  }
}

/**
 * AppModule wired the way app.factory.ts wires it — the global ProblemFilter
 * included, because a controller-scoped filter that "wins" against no
 * competitor proves nothing — with `AppConfig` replaced so a store can be
 * taken away, and pino pointed at `lines`.
 */
async function bootApp(config: AppConfig): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(config)
    .overrideProvider(PARAMS_PROVIDER_TOKEN)
    .useValue(capturingParams(config))
    .compile()
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )
  // app.factory.ts:37, the line this file's precedence tests exist to rank
  // a controller-scoped filter against.
  app.useGlobalFilters(new ProblemFilter(config.nodeEnv))
  app.useLogger(app.get(Logger))
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}

describe('GET /health/ready', () => {
  let app: NestFastifyApplication
  let db: Db

  beforeAll(async () => {
    app = await bootApp(configWith({}))
    db = app.get<Db>(DRIZZLE)
  })

  beforeEach(async () => {
    lines.length = 0
    await truncateAll(db, ['outbox_events'])
  })

  afterAll(async () => {
    await app.close()
  })

  it('reports every store up', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(200)
    const body = health(res)
    expect(body.status).toBe('ok')
    expect(body.details.postgres?.status).toBe('up')
    expect(body.details.redis?.status).toBe('up')
  })

  it('reports the parked-event count as a non-failing detail', async () => {
    await db.insert(outboxEvents).values({
      aggregateType: 'thing',
      aggregateId: '0199f3c0-1111-7000-8000-000000000000',
      eventType: 'test.thing.dead',
      payload: {},
      attempts: 5,
      lastError: 'parked',
    })

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    // Parked events need a human, but the service is still serving: this
    // must stay 200 or Liara stops routing to a healthy container.
    expect(res.statusCode).toBe(200)
    const body = health(res)
    expect(body.details.outbox?.dead).toBe(1)
    expect(body.details.outbox?.status).toBe('up')
  })

  it('counts only parked rows, not merely unpublished ones', async () => {
    await db.insert(outboxEvents).values({
      aggregateType: 'thing',
      aggregateId: '0199f3c0-1111-7000-8000-000000000000',
      eventType: 'test.thing.pending',
      payload: {},
      attempts: 1,
    })
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(health(res).details.outbox?.dead).toBe(0)
  })

  // Without this row, deleting `isNull(outboxEvents.publishedAt)` from the
  // indicator's WHERE breaks NO test above: nothing else in this file is both
  // published AND at the attempt ceiling. An event that failed its way to
  // five attempts and was then republished would be counted dead forever, and
  // `/health/ready` would report a backlog that does not exist.
  it('stops counting a parked row once it is published', async () => {
    await db.insert(outboxEvents).values({
      aggregateType: 'thing',
      aggregateId: '0199f3c0-3333-7000-8000-000000000000',
      eventType: 'test.thing.recovered',
      payload: {},
      attempts: MAX_ATTEMPTS,
      publishedAt: new Date(),
    })
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(health(res).details.outbox?.dead).toBe(0)
  })

  it('still answers /health/live without touching any store', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' })
    expect(res.statusCode).toBe(200)
  })

  // Step 5 requirement 2: scoping a filter to the health controller must not
  // move anything else. Every other route is still the ProblemFilter's.
  it('leaves every other route to the problem filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expect(JSON.parse(res.payload)).toMatchObject({
      type: 'urn:problem:NOT_FOUND',
      code: 'NOT_FOUND',
    })
  })
})

describe('GET /health/ready with Postgres unreachable', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await bootApp(configWith({ DATABASE_URL: UNREACHABLE_POSTGRES }))
  })

  beforeEach(() => {
    lines.length = 0
  })

  afterAll(async () => {
    await app.close()
  })

  // The whole reason this endpoint exists: a container that cannot reach
  // Postgres must not take traffic, and the body must say which store.
  it("answers 503 carrying Terminus's body, naming postgres down", async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    const body = health(res)
    expect(body.status).toBe('error')
    expect(body.details.postgres?.status).toBe('down')
    expect(body.error.postgres?.status).toBe('down')
  })

  // Precedence, measured rather than inferred from Nest's binding order:
  // remove @UseFilters from the controller and the globally registered
  // ProblemFilter answers instead, with an RFC 9457 body whose title reads
  // "Internal Server Error" and whose `details` — the only part naming the
  // failing store — is gone.
  it('out-ranks the globally registered ProblemFilter', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.headers['content-type']).not.toContain('problem+json')
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.payload).not.toContain('urn:problem:')
    expect(res.payload).not.toContain('Internal Server Error')
  })

  // The indicators are independent, so a Postgres outage must not be
  // reported as a Redis one.
  it('still reports redis up', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(health(res).details.redis?.status).toBe('up')
  })

  // Liara probes on an interval. ProblemFilter's `status >= 500` branch would
  // otherwise write one full stack per probe for the length of the outage.
  it('logs no stack trace', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    expect(lines.filter((line) => line.includes('"stack"'))).toEqual([])
    expect(lines.filter((line) => line.includes('ProblemFilter'))).toEqual([])
  })
})

describe('GET /health with Redis unreachable', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await bootApp(configWith({ REDIS_URL: UNREACHABLE_REDIS }))
  })

  beforeEach(() => {
    lines.length = 0
  })

  // Deliberately not `app.close()`. Measured: it never returns. RedisCloser
  // calls `quit()` on a client that is still trying to reach a closed port,
  // ioredis queues it behind the probe it has not given up on, and with the
  // client manually closing nothing is left to flush that queue — 20s in, the
  // close had not settled and the status was still `reconnecting`. That is a
  // real graceful-shutdown defect in RedisModule, not in this endpoint: a
  // SIGTERM during a Redis outage would hang the container the same way. It
  // is recorded against Task 14's RedisCloser rather than fixed here, and the
  // two resources this suite actually holds are released by hand so it cannot
  // hang the run.
  afterAll(async () => {
    app.get<Redis>(REDIS).disconnect()
    await app.get<Pool>(PG_POOL).end()
  })

  // ThrottlerGuard is a global APP_GUARD over Redis-backed storage: it runs
  // ahead of both health routes and increments a counter in Redis on every
  // probe. A liveness probe that 500s during a Redis blip restart-loops the
  // container, which is the whole reason the Docker HEALTHCHECK is on this
  // route rather than on /health/ready.
  it('answers /health/live 200, untouched by the Redis-backed throttler', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toMatchObject({ status: 'ok' })
  })

  it('answers /health/ready 503 naming redis down, never 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    const body = health(res)
    expect(body.status).toBe('error')
    expect(body.details.redis?.status).toBe('down')
    expect(body.details.postgres?.status).toBe('up')
  })

  // Measured: ioredis queues a command against a closed port and rejects it
  // with MaxRetriesPerRequestError only after 20 reconnect attempts, ~10.5s.
  // A readiness probe that takes that long does not report an outage; it
  // times out, and Liara learns nothing. The indicator bounds its own wait.
  it('bounds the redis probe instead of waiting out ioredis', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(health(res).details.redis?.message).toContain('timed out')
  })

  it('logs no stack trace', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(503)
    expect(lines.filter((line) => line.includes('"stack"'))).toEqual([])
    expect(lines.filter((line) => line.includes('ProblemFilter'))).toEqual([])
  })
})
