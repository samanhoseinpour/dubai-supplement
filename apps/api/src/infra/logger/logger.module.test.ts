import { describe, expect, it } from 'vitest'
import { pinoHttp, type Options } from 'pino-http'
import { buildLoggerOptions } from './logger.module.js'
// The config barrel evaluates `ConfigModule`, whose `forRoot({ envFilePath:
// '.env', validate })` runs at decoration time: this file needs a schema-valid
// environment at import, exactly as the integration tests do.
import { AppConfig, EnvSchema } from '../config/index.js'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

const config = (over: Record<string, string> = {}) =>
  new AppConfig(
    EnvSchema.parse({
      DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/d',
      REDIS_URL: 'redis://127.0.0.1:6379/0',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
      ...over,
    }),
  )

/**
 * The options object handed to pino-http, or a failure if `buildLoggerOptions`
 * ever returns one of the other forms `Params.pinoHttp` admits (a bare
 * destination stream, or an `[options, stream]` tuple).
 */
function httpOptions(appConfig: AppConfig): Options {
  const { pinoHttp: value } = buildLoggerOptions(appConfig)
  if (value === undefined || Array.isArray(value) || 'write' in value) {
    throw new Error('expected buildLoggerOptions to return a pino-http options object')
  }
  return value
}

describe('buildLoggerOptions', () => {
  it('redacts credentials that would otherwise be logged in full', () => {
    const redact = httpOptions(config()).redact
    const paths = Array.isArray(redact) ? redact : redact?.paths
    expect(paths).toEqual(
      expect.arrayContaining([
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
      ]),
    )
  })

  it('uses pino-pretty in development and plain JSON in production', () => {
    expect(httpOptions(config({ NODE_ENV: 'development' })).transport).toBeDefined()
    expect(httpOptions(config({ NODE_ENV: 'production' })).transport).toBeUndefined()
  })

  // pino-pretty is a devDependency: only development may reach for it.
  it('attaches no transport outside development', () => {
    expect(httpOptions(config({ NODE_ENV: 'test' })).transport).toBeUndefined()
  })

  it('honours an inbound x-request-id instead of inventing a new one', () => {
    const genReqId = httpOptions(config()).genReqId
    const req = { headers: { 'x-request-id': 'abc-123' } }
    expect(genReqId?.(req as never, {} as never)).toBe('abc-123')
  })

  it('generates an id when the header is absent', () => {
    const genReqId = httpOptions(config()).genReqId
    const id = genReqId?.({ headers: {} } as never, {} as never)
    expect(typeof id).toBe('string')
    expect(id).not.toHaveLength(0)
  })

  // The id is echoed back and searched on, so it is a plain token or nothing:
  // an oversized or oddly spelt value is replaced, never trusted.
  it('mints a UUID instead of an inbound id that is not a plain token', () => {
    const genReqId = httpOptions(config()).genReqId
    const idFor = (value: string) =>
      genReqId?.({ headers: { 'x-request-id': value } } as never, {} as never)
    for (const value of ['a'.repeat(129), 'not a token', 'id;drop', '/path?x=1', '%41', '']) {
      expect(idFor(value)).toMatch(UUID_V4)
    }
    expect(idFor('a'.repeat(128))).toBe('a'.repeat(128))
    expect(idFor('req_1.0-b')).toBe('req_1.0-b')
  })
})

/** What a request-completed line looks like once parsed back. */
interface LogLine {
  req: { id?: string; headers: Record<string, unknown> }
  res: { headers: Record<string, unknown> }
}

function capture() {
  const lines: string[] = []
  return {
    lines,
    stream: {
      write: (msg: string) => {
        lines.push(msg)
      },
    },
  }
}

// A path that silently fails to match looks like protection and is not. These
// drive the real logger pino-http builds from the production options, through
// the same serializers the request middleware uses, and read the line back.
describe('the logger pino-http builds from these options', () => {
  // Node's `IncomingMessage.headers` and `ServerResponse.getHeaders()` are
  // what pino-http's serializers read; the shapes here are theirs.
  const req = {
    id: 'req-1',
    method: 'GET',
    url: '/account',
    headers: {
      host: 'api.internal',
      cookie: 'ds_session=SESSION-SECRET',
      authorization: 'Bearer TOKEN-SECRET',
      'x-request-id': 'req-1',
    },
    socket: { remoteAddress: '127.0.0.1', remotePort: 51234 },
  }
  const res = {
    statusCode: 200,
    headersSent: true,
    getHeaders: () => ({
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': ['ds_session=NEW-SESSION-SECRET; Path=/; HttpOnly; Secure; SameSite=Lax'],
    }),
  }

  it('emits [redacted] in place of the cookie, authorization and set-cookie values', () => {
    const { lines, stream } = capture()
    const { logger } = pinoHttp(httpOptions(config({ NODE_ENV: 'production' })), stream)

    // pino-http binds `req` on a child logger and logs `res` on completion.
    logger.child({ req }).info({ res, responseTime: 3 }, 'request completed')

    expect(lines).toHaveLength(1)
    const line = lines.join('')
    expect(line).not.toContain('SESSION-SECRET')
    expect(line).not.toContain('TOKEN-SECRET')

    const parsed = JSON.parse(line) as LogLine
    expect(parsed.req.headers.cookie).toBe('[redacted]')
    expect(parsed.req.headers.authorization).toBe('[redacted]')
    expect(parsed.res.headers['set-cookie']).toBe('[redacted]')
    // The neighbours survive: the censor hit the paths, not the objects.
    expect(parsed.req.headers.host).toBe('api.internal')
    expect(parsed.req.id).toBe('req-1')
    expect(parsed.res.headers['content-type']).toBe('application/json; charset=utf-8')
  })

  it('honours LOG_LEVEL', () => {
    const { lines, stream } = capture()
    const { logger } = pinoHttp(
      httpOptions(config({ NODE_ENV: 'production', LOG_LEVEL: 'warn' })),
      stream,
    )
    logger.info('below the configured level')
    expect(lines).toHaveLength(0)
    logger.warn('at the configured level')
    expect(lines).toHaveLength(1)
  })

  it('names pino-pretty as the development transport', () => {
    expect(httpOptions(config({ NODE_ENV: 'development' })).transport).toMatchObject({
      target: 'pino-pretty',
    })
  })
})
