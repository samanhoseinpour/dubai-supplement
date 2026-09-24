import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { Controller, Get, Module, Res } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { Redis } from 'ioredis'
import { type ProblemDetails, ProblemDetailsSchema } from '@ds/contracts'
import { AppModule } from '../../src/app.module.js'
import { AppConfig, EnvSchema } from '../../src/infra/config/index.js'
import {
  buildThrottlerOptions,
  ProblemFilter,
  registerSecurity,
  THROTTLE_LIMIT,
  THROTTLE_TTL_MS,
} from '../../src/infra/http/index.js'
import { flushRedis } from '../setup/truncate.js'

/**
 * The slice of Fastify's reply the cookie route drives — `@fastify/cookie`'s
 * decoration — typed structurally: the api depends on
 * `@nestjs/platform-fastify`, not on `fastify` itself.
 */
interface CookieReply {
  setCookie(name: string, value: string): unknown
}

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true }
  }

  // No options on purpose: what comes back is what `registerSecurity` made
  // the default for every cookie the API will ever set.
  @Get('cookie')
  cookie(@Res({ passthrough: true }) reply: CookieReply) {
    reply.setCookie('probe', '1')
    return { ok: true }
  }
}

/**
 * The fixture controller as its own module, so it can be added beside the
 * real AppModule: AppModule's own routes are the health ones, and those are
 * deliberately uncounted (`@SkipThrottle()`, Task 15).
 */
@Module({ controllers: [PingController] })
class PingModule {}

const makeConfig = (over: Record<string, string> = {}) =>
  new AppConfig(
    EnvSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/d',
      // No fallback: this file flushes whatever it is pointed at, and a
      // default of localhost:6379 would be the developer's own dev Redis.
      // The Testcontainers global setup is what writes this.
      REDIS_URL: process.env.REDIS_URL,
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
      ...over,
    }),
  )

interface Ctx {
  readonly app: NestFastifyApplication
  readonly redis: Redis
}

/**
 * The guard and the Redis storage at a chosen limit, `registerSecurity` and
 * the problem filter as main.ts wires them, behind an adapter that trusts
 * what the config trusts. Counters outlive a describe block, so the harness's
 * Redis is flushed first: a bucket left by an earlier one turns [200, 200,
 * 429] into [429, 429, 429]. It is the container's, never a shared instance.
 */
async function build(config: AppConfig, limit: number): Promise<Ctx> {
  await flushRedis(config.redisUrl)
  const redis = new Redis(config.redisUrl)

  @Module({
    imports: [
      ThrottlerModule.forRoot({
        ...buildThrottlerOptions(redis),
        throttlers: [{ ttl: THROTTLE_TTL_MS, limit }],
      }),
    ],
    controllers: [PingController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
  class TestModule {}

  const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile()
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false, trustProxy: config.trustProxy }),
  )
  await registerSecurity(app, config)
  app.useGlobalFilters(new ProblemFilter('test'))
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return { app, redis }
}

async function teardown(ctx: Ctx): Promise<void> {
  await ctx.app.close()
  ctx.redis.disconnect()
}

/**
 * Where the storage counts a client: the guard hashes
 * `<Class>-<handler>-<throttler>-<tracker>` and @nest-lab wraps that as
 * `{<hash>:<throttler>}:hits` / `:blocked` (@nestjs/throttler 6.7.0,
 * @nest-lab/throttler-storage-redis 1.2.0). ADR-0017 records that the keys
 * rotate on upgrade; pinning today's shape is the point.
 */
function bucket(tracker: string, controller = 'PingController', handler = 'ping'): string {
  const hash = createHash('sha256')
    .update(`${controller}-${handler}-default-${tracker}`)
    .digest('hex')
  return `{${hash}:default}`
}

const hitsKey = (...args: Parameters<typeof bucket>) => `${bucket(...args)}:hits`
const blockedKey = (...args: Parameters<typeof bucket>) => `${bucket(...args)}:blocked`

/** What `app.inject()` resolves to, as far as these tests read it. */
interface Injected {
  readonly statusCode: number
  readonly headers: Readonly<Record<string, unknown>>
  readonly payload: string
}

// Strict: a member outside the contract fails here instead of being stripped.
const StrictProblemDetailsSchema = ProblemDetailsSchema.strict()

/** The body parsed back, after checking the media type and the contract. */
function problem(res: Injected): ProblemDetails {
  expect(res.headers['content-type']).toContain('application/problem+json')
  return StrictProblemDetailsSchema.parse(JSON.parse(res.payload))
}

describe('security wiring', () => {
  describe('helmet, cookies and an empty CORS allowlist', () => {
    let ctx: Ctx

    beforeAll(async () => {
      ctx = await build(makeConfig(), THROTTLE_LIMIT)
    })

    afterAll(() => teardown(ctx))

    it('sets helmet headers and removes the framework fingerprint', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/ping' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
      expect(res.headers['strict-transport-security']).toContain('max-age=')
      expect(res.headers['content-security-policy']).toContain("default-src 'self'")
      expect(res.headers['referrer-policy']).toBe('no-referrer')
      expect(res.headers['x-powered-by']).toBeUndefined()
    })

    it('sends no CORS header when CORS_ORIGINS is empty', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/ping',
        headers: { origin: 'https://evil.example' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
      expect(res.headers['access-control-allow-credentials']).toBeUndefined()
    })

    it('sets every cookie httpOnly, Secure, SameSite=Lax and without a Domain', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/ping/cookie' })
      expect(res.statusCode).toBe(200)
      const raw = res.headers['set-cookie']
      const cookies = Array.isArray(raw) ? raw : [raw]
      expect(cookies).toHaveLength(1)
      const [cookie] = cookies
      expect(cookie).toMatch(/^probe=1;/u)
      expect(cookie).toMatch(/;\s*HttpOnly/u)
      expect(cookie).toMatch(/;\s*Secure/u)
      expect(cookie).toMatch(/;\s*SameSite=Lax/u)
      expect(cookie).not.toMatch(/Domain=/iu)
    })
  })

  describe('CORS with an allowlist', () => {
    let ctx: Ctx

    beforeAll(async () => {
      ctx = await build(
        makeConfig({ CORS_ORIGINS: 'https://shop.example.ir,https://admin.example.ir' }),
        THROTTLE_LIMIT,
      )
    })

    afterAll(() => teardown(ctx))

    it('reflects a listed origin, with credentials', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/ping',
        headers: { origin: 'https://admin.example.ir' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['access-control-allow-origin']).toBe('https://admin.example.ir')
      expect(res.headers['access-control-allow-credentials']).toBe('true')
      expect(res.headers['vary']).toContain('Origin')
    })

    // Exact match only: a subdomain grafted onto a listed host, a scheme
    // downgrade and a stranger all get nothing back.
    it('sends no Access-Control-Allow-Origin to an origin outside the list', async () => {
      for (const origin of [
        'https://evil.example',
        'https://shop.example.ir.evil.example',
        'http://shop.example.ir',
      ]) {
        const res = await ctx.app.inject({ method: 'GET', url: '/ping', headers: { origin } })
        expect(res.statusCode).toBe(200)
        expect(res.headers['access-control-allow-origin']).toBeUndefined()
      }
    })

    it('answers a preflight with the explicit method list', async () => {
      const res = await ctx.app.inject({
        method: 'OPTIONS',
        url: '/ping',
        headers: { origin: 'https://shop.example.ir', 'access-control-request-method': 'PATCH' },
      })
      expect(res.statusCode).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBe('https://shop.example.ir')
      expect(res.headers['access-control-allow-methods']).toBe('GET, POST, PATCH, DELETE, OPTIONS')
    })

    // The preflight is still answered — the refusal is the missing origin
    // header, which makes the browser drop the actual request.
    it('answers a preflight from an unlisted origin without an allowed origin', async () => {
      const res = await ctx.app.inject({
        method: 'OPTIONS',
        url: '/ping',
        headers: { origin: 'https://evil.example', 'access-control-request-method': 'PATCH' },
      })
      expect(res.statusCode).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })
  })

  describe('throttling through Redis', () => {
    let ctx: Ctx

    beforeAll(async () => {
      ctx = await build(makeConfig(), 2)
    })

    afterAll(() => teardown(ctx))

    // light-my-request's peer is 127.0.0.1 unless told otherwise — loopback,
    // which the config trusts, so the forwarded address is the client.
    const hit = (ip: string, remoteAddress = '127.0.0.1') =>
      ctx.app.inject({
        method: 'GET',
        url: '/ping',
        headers: { 'x-forwarded-for': ip },
        remoteAddress,
      })

    it('throttles per forwarded IP, counting through Redis', async () => {
      expect((await hit('203.0.113.9')).statusCode).toBe(200)
      expect((await hit('203.0.113.9')).statusCode).toBe(200)
      expect((await hit('203.0.113.9')).statusCode).toBe(429)
      // A different client must still be served — otherwise the tracker is
      // keying on the proxy rather than the forwarded address.
      expect((await hit('203.0.113.10')).statusCode).toBe(200)

      // The counters are in Redis, one bucket per forwarded address, and
      // none for the proxy itself.
      expect(await ctx.redis.get(hitsKey('203.0.113.9'))).toBe('3')
      expect(await ctx.redis.get(blockedKey('203.0.113.9'))).toBe('1')
      expect(await ctx.redis.get(hitsKey('203.0.113.10'))).toBe('1')
      expect(await ctx.redis.exists(blockedKey('203.0.113.10'))).toBe(0)
      expect(await ctx.redis.exists(hitsKey('127.0.0.1'))).toBe(0)
    })

    it('returns 429 as an RFC 9457 problem, not Nest default JSON', async () => {
      const res = await hit('203.0.113.9')
      expect(res.statusCode).toBe(429)
      expect(problem(res)).toMatchObject({
        type: 'urn:problem:RATE_LIMITED',
        title: 'Rate Limited',
        status: 429,
        code: 'RATE_LIMITED',
      })
      // ThrottlerException's own text, which Nest's default body would carry.
      expect(res.payload).not.toContain('Too Many Requests')
      // What a client backs off with: seconds until the block expires, set by
      // the guard before it throws and kept by the filter.
      const retryAfter = Number(res.headers['retry-after'])
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(THROTTLE_TTL_MS / 1000)
    })

    // Spec §5.5: X-Forwarded-For from an untrusted hop is ignored. The peer is
    // outside loopback and the RFC 1918 ranges, so proxy-addr stops at it and
    // every request shares its bucket whatever the header claims.
    it('ignores X-Forwarded-For from an untrusted hop', async () => {
      const untrusted = '198.51.100.7'
      expect((await hit('203.0.113.11', untrusted)).statusCode).toBe(200)
      expect((await hit('203.0.113.12', untrusted)).statusCode).toBe(200)
      expect((await hit('203.0.113.13', untrusted)).statusCode).toBe(429)

      expect(await ctx.redis.get(hitsKey(untrusted))).toBe('3')
      expect(await ctx.redis.exists(hitsKey('203.0.113.11'))).toBe(0)
    })
  })

  // The wiring main.ts boots: without the APP_GUARD provider, or with the
  // in-memory storage, everything above would still pass. The guard, its
  // options and its Redis storage all come from AppModule here; PingModule
  // only supplies a route for the global guard to act on, because AppModule's
  // own routes are the two health ones and those are deliberately uncounted.
  describe('AppModule', () => {
    let app: NestFastifyApplication
    let redis: Redis

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule, PingModule],
      }).compile()
      const config = moduleRef.get(AppConfig)
      await flushRedis(config.redisUrl)
      redis = new Redis(config.redisUrl)
      app = moduleRef.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter({ logger: false, trustProxy: config.trustProxy }),
      )
      await app.init()
      await app.getHttpAdapter().getInstance().ready()
    })

    afterAll(async () => {
      await app.close()
      redis.disconnect()
    })

    it('guards every route at THROTTLE_LIMIT per client, counting in Redis', async () => {
      const client = '203.0.113.120'
      const hit = () =>
        app.inject({ method: 'GET', url: '/ping', headers: { 'x-forwarded-for': client } })

      for (let i = 0; i < THROTTLE_LIMIT; i += 1) {
        expect((await hit()).statusCode).toBe(200)
      }
      expect((await hit()).statusCode).toBe(429)
      expect(await redis.get(hitsKey(client))).toBe(String(THROTTLE_LIMIT + 1))
    })

    // The exception, and the reason it is one: the guard's storage is Redis,
    // so counting a probe means reaching Redis before the route runs — and a
    // Redis outage then turns /health/live into a 500 after ioredis gives up,
    // which restart-loops the container, because the Docker HEALTHCHECK
    // points there (Task 15, §5.5). `@SkipThrottle()` on the controller is
    // what keeps both probes off Redis; deleting it puts a bucket here.
    it('counts nothing for the health routes', async () => {
      const client = '203.0.113.121'
      for (const url of ['/health/live', '/health/ready']) {
        const res = await app.inject({ method: 'GET', url, headers: { 'x-forwarded-for': client } })
        expect(res.statusCode).toBe(200)
      }
      expect(await redis.exists(hitsKey(client, 'HealthController', 'live'))).toBe(0)
      expect(await redis.exists(hitsKey(client, 'HealthController', 'ready'))).toBe(0)
    })
  })
})
