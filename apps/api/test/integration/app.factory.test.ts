import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createApp } from '../../src/app.factory.js'

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
})
