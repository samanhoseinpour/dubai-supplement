import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { PARAMS_PROVIDER_TOKEN, type Params } from 'nestjs-pino'
import { AppModule } from '../../src/app.module.js'
import { AppConfig, EnvSchema } from '../../src/infra/config/index.js'
import { buildLoggerOptions } from '../../src/infra/logger/index.js'

/** The request-completed line pino-http writes, parsed back. */
interface RequestLine {
  msg: string
  req: { id?: unknown; headers: Record<string, unknown> }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

const production = new AppConfig(
  EnvSchema.parse({
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/d',
    REDIS_URL: 'redis://127.0.0.1:6379/0',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_BUCKET: 'b',
    S3_ACCESS_KEY_ID: 'k',
    S3_SECRET_ACCESS_KEY: 's',
  }),
)

/**
 * The production options — no transport, so pino writes to the stream it is
 * handed — paired with a capturing stream, through the same provider token the
 * module's own factory fills. nestjs-pino builds its pino-http instance once
 * per process, on first use, so this file boots the application exactly once.
 */
function capturingParams(lines: string[]): Params {
  const options = buildLoggerOptions(production).pinoHttp
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

describe('request logging, end to end', () => {
  const lines: string[] = []
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(capturingParams(lines))
      .compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    lines.length = 0
  })

  // pino-http logs on the response's `finish` event; wait for it rather than
  // assume it fired before `inject` resolved.
  async function completedLine(): Promise<{ raw: string; parsed: RequestLine }> {
    await vi.waitFor(() => {
      expect(lines.some((line) => line.includes('"request completed"'))).toBe(true)
    })
    const raw = lines.filter((line) => line.includes('"request completed"')).join('')
    return { raw, parsed: JSON.parse(raw) as RequestLine }
  }

  it('redacts the cookie and authorization headers of a real request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: {
        cookie: 'ds_session=SESSION-SECRET',
        authorization: 'Bearer TOKEN-SECRET',
        'x-request-id': 'corr-abc-123',
      },
    })
    expect(res.statusCode).toBe(200)

    const { raw, parsed } = await completedLine()
    expect(raw).not.toContain('SESSION-SECRET')
    expect(raw).not.toContain('TOKEN-SECRET')
    expect(parsed.req.headers.cookie).toBe('[redacted]')
    expect(parsed.req.headers.authorization).toBe('[redacted]')
    expect(parsed.req.id).toBe('corr-abc-123')
  })

  // A UUID, not Fastify's own `req-N` counter: that one restarts at 1 with the
  // process and repeats across instances, so it cannot identify a request.
  it('mints a UUID when the caller sends none', async () => {
    await app.inject({ method: 'GET', url: '/health/live' })

    const { parsed } = await completedLine()
    expect(parsed.req.id).toMatch(UUID_V4)
  })

  // The header itself is still logged, once, like any other request header;
  // it is the id — echoed back and searched on — that must not carry it.
  it('replaces an inbound id that is not a plain token with a UUID', async () => {
    const oversized = `not a token; ${'x'.repeat(200)}`
    await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': oversized },
    })

    const { parsed } = await completedLine()
    expect(parsed.req.id).toMatch(UUID_V4)
  })
})
