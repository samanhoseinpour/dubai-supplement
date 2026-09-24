import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ProblemDetailsSchema } from '@ds/contracts'

/**
 * `ConfigModule.forRoot` validates the environment while the module is
 * decorated — at import, not when `createApp()` runs — so each state needs
 * the factory imported afresh after the variable is stubbed. A process value
 * wins over `.env` (`forRoot` merges `{ ...file, ...process.env }`), so the
 * developer's own `.env` does not decide the outcome.
 */
async function bootWith(openapiUiEnabled: 'true' | 'false'): Promise<NestFastifyApplication> {
  vi.stubEnv('OPENAPI_UI_ENABLED', openapiUiEnabled)
  vi.resetModules()
  const { createApp } = await import('../../src/app.factory.js')
  const app = await createApp()
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}

describe('the Swagger UI behind createApp()', () => {
  let app: NestFastifyApplication | undefined

  afterEach(async () => {
    await app?.close()
    app = undefined
    vi.unstubAllEnvs()
  })

  describe('with OPENAPI_UI_ENABLED=true', () => {
    it('serves the page at /docs under the same helmet headers as every route', async () => {
      app = await bootWith('true')
      const page = await app.inject({ method: 'GET', url: '/docs' })
      expect(page.statusCode).toBe(200)
      expect(page.headers['content-type']).toContain('text/html')
      expect(page.payload).toContain('<div id="swagger-ui">')

      // Not a relaxed policy: the page carries exactly what a 404 on the same
      // app carries — helmet's defaults, script-src 'self' among them.
      const other = await app.inject({ method: 'GET', url: '/nope' })
      expect(page.headers['content-security-policy']).toBe(other.headers['content-security-policy'])
      expect(page.headers['content-security-policy']).toContain("script-src 'self';")

      // What lets that policy hold, and the part a browser-less test can
      // guard: every script on the page is an external same-origin file, none
      // inline, no inline handlers. A future swagger-ui-dist or a customJsStr
      // that reintroduces an inline bootstrap fails here.
      const scripts = page.payload.match(/<script\b[^>]*>/gu) ?? []
      expect(scripts.length).toBeGreaterThan(0)
      for (const tag of scripts) expect(tag).toMatch(/\ssrc=['"]\.\/docs\//u)
      expect(page.payload).not.toMatch(/\son[a-z]+=/iu)
    })

    it('serves the bootstrap with the document inlined, and the bundle from disk', async () => {
      app = await bootWith('true')
      const init = await app.inject({ method: 'GET', url: '/docs/swagger-ui-init.js' })
      expect(init.statusCode).toBe(200)
      expect(init.headers['content-type']).toContain('javascript')
      expect(init.payload).toContain('"title": "Dubai Supplement API"')
      expect(init.payload).toContain('"/health/live"')

      // @fastify/static, which SwaggerModule.setup registers for the Fastify
      // adapter — the process exits at boot when it is missing.
      const bundle = await app.inject({ method: 'GET', url: '/docs/swagger-ui-bundle.js' })
      expect(bundle.statusCode).toBe(200)
      expect(bundle.headers['content-type']).toContain('javascript')
    })
  })

  describe('with OPENAPI_UI_ENABLED=false', () => {
    it('answers /docs and everything under it with a 404 problem', async () => {
      app = await bootWith('false')
      for (const url of [
        '/docs',
        '/docs/swagger-ui-init.js',
        '/docs/swagger-ui-bundle.js',
        '/docs-json',
      ]) {
        const res = await app.inject({ method: 'GET', url })
        expect(res.statusCode).toBe(404)
        expect(res.headers['content-type']).toContain('application/problem+json')
        expect(ProblemDetailsSchema.parse(JSON.parse(res.payload)).code).toBe('NOT_FOUND')
      }
    })
  })
})
