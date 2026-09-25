import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ProblemDetailsSchema } from '@ds/contracts'
import {
  adapterOptions,
  BODY_LIMIT_BYTES,
  createApp,
  MAX_PARAM_LENGTH,
} from '../../src/app.factory.js'
import { AppConfig, validatedEnv } from '../../src/infra/config/index.js'

/**
 * The production path: everything main.ts boots, short of listening. The
 * other integration files replicate that wiring against fixture modules;
 * this one exercises it, so a line dropped from the factory — the security
 * plugins, the adapter's trust list, the filter — fails here and nowhere
 * else. One app, a handful of requests.
 */
describe('createApp', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await createApp()
    // A raw Fastify route that reports what `req.ip` resolved to — the value
    // the throttler keys on — so the adapter's trust list is observed
    // directly rather than inferred from counters in Redis.
    app
      .getHttpAdapter()
      .getInstance()
      .get('/probe/ip', (req) => ({ ip: req.ip }))
    // What `rawBody: true` produces, reported back: the option is invisible
    // to every other assertion in the suite, and a request is the only thing
    // that can tell whether Nest installed the parser that fills it.
    app
      .getHttpAdapter()
      .getInstance()
      .post('/probe/raw', (req) => {
        const { rawBody } = req as { rawBody?: unknown }
        return {
          isBuffer: Buffer.isBuffer(rawBody),
          text: Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : null,
        }
      })
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('boots with helmet, trusts only the configured proxies and answers problems', async () => {
    const live = await app.inject({ method: 'GET', url: '/health/live' })
    expect(live.statusCode).toBe(200)
    expect(live.headers['x-content-type-options']).toBe('nosniff')
    expect(live.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(live.headers['strict-transport-security']).toContain('max-age=')
    expect(live.headers['content-security-policy']).toContain("default-src 'self'")

    // TRUST_PROXY is loopback,uniquelocal — pinned by
    // vitest.integration.config.ts's `env`, not read from the developer's
    // .env: a forwarded address from the loopback peer is the client, and the
    // same header from a peer outside the trusted networks is ignored — that
    // peer is the client.
    const forwarded = await app.inject({
      method: 'GET',
      url: '/probe/ip',
      headers: { 'x-forwarded-for': '203.0.113.51' },
    })
    expect(JSON.parse(forwarded.payload)).toEqual({ ip: '203.0.113.51' })
    const spoofed = await app.inject({
      method: 'GET',
      url: '/probe/ip',
      headers: { 'x-forwarded-for': '203.0.113.50' },
      remoteAddress: '198.51.100.8',
    })
    expect(JSON.parse(spoofed.payload)).toEqual({ ip: '198.51.100.8' })

    // The problem filter, on the same app: not Nest's default 404 JSON.
    const nope = await app.inject({ method: 'GET', url: '/nope' })
    expect(nope.statusCode).toBe(404)
    expect(nope.headers['content-type']).toContain('application/problem+json')

    // And the graph this file claims to exercise is the one production
    // boots: no Swagger UI. OPENAPI_UI_ENABLED is pinned false by
    // vitest.integration.config.ts's `env` for the same reason TRUST_PROXY
    // is — unpinned, `.env.example` sets it true, so the factory registered
    // SwaggerModule on a developer's machine and not in CI, and this file
    // silently exercised two different graphs. openapi-ui.test.ts owns both
    // branches; here there is only the production one.
    const docs = await app.inject({ method: 'GET', url: '/docs' })
    expect(docs.statusCode).toBe(404)
  })

  /**
   * Three lines of deliberate adapter policy (`.claude/rules/api.md`) that
   * no request could distinguish from Fastify's own behaviour, and that were
   * therefore deletable with `pnpm check` staying green: `bodyLimit`,
   * `rawBody: true` and problem.filter.ts's 413 → VALIDATION_FAILED row.
   *
   * `bodyLimit` restates Fastify 5's default, so no request can prove the
   * line exists — asserting a value identical to the library's own default
   * is the `pool.max = 10` defect. What makes it ours is that the object the
   * adapter is built from is asserted whole; the request below then proves
   * that object is the one production runs on.
   */
  describe('the adapter policy', () => {
    it('is the whole object the adapter is built from, defaults restated and all', () => {
      expect(adapterOptions(new AppConfig(validatedEnv()))).toEqual({
        logger: false,
        trustProxy: 'loopback,uniquelocal',
        bodyLimit: BODY_LIMIT_BYTES,
        routerOptions: { maxParamLength: MAX_PARAM_LENGTH },
      })
      expect(BODY_LIMIT_BYTES).toBe(1_048_576)
      expect(MAX_PARAM_LENGTH).toBe(8192)
    })

    it('keeps the raw body, and refuses one over the limit as a problem', async () => {
      const kept = await app.inject({
        method: 'POST',
        url: '/probe/raw',
        headers: { 'content-type': 'application/json' },
        payload: '{"a":"ب"}',
      })
      expect(kept.statusCode).toBe(200)
      // Bytes, not the parsed body: «ب» is two UTF-8 bytes and one character,
      // so a handler verifying a webhook signature reads what was sent.
      expect(JSON.parse(kept.payload)).toEqual({ isBuffer: true, text: '{"a":"ب"}' })

      const tooLarge = await app.inject({
        method: 'POST',
        url: '/probe/raw',
        headers: { 'content-type': 'application/json' },
        payload: `"${'x'.repeat(BODY_LIMIT_BYTES)}"`,
      })
      expect(tooLarge.statusCode).toBe(413)
      expect(tooLarge.headers['content-type']).toContain('application/problem+json')
      expect(ProblemDetailsSchema.parse(JSON.parse(tooLarge.payload)).code).toBe(
        'VALIDATION_FAILED',
      )
    })
  })
})
