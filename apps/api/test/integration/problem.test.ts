import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { Controller, ForbiddenException, Get, HttpException, Module } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Logger, PARAMS_PROVIDER_TOKEN, type Params } from 'nestjs-pino'
import { type ProblemDetails, ProblemDetailsSchema } from '@ds/contracts'
import { AppConfig, ConfigModule, EnvSchema } from '../../src/infra/config/index.js'
import { ProblemFilter } from '../../src/infra/http/index.js'
import { buildLoggerOptions, LoggerModule } from '../../src/infra/logger/index.js'
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../src/shared/errors/index.js'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

/** A throw no TypeScript code writes on purpose, as a dependency might. */
function thrown(value: unknown): never {
  throw value
}

@Controller('boom')
class BoomController {
  @Get('notfound')
  notFound(): never {
    throw new NotFoundError('CATALOG_BRAND_NOT_FOUND', 'no such brand')
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictError('CATALOG_BRAND_SLUG_TAKEN')
  }

  @Get('invalid')
  invalid(): never {
    // Zod emits PropertyKey segments; the Standard Schema spec also permits
    // `{ key }` segments (spec §5.5). One issue without a path at all, and
    // one with a null segment nothing emits — a filter still must not throw.
    throw new ValidationError([
      { message: 'expected string', path: ['items', 0, { key: 'sku' }] },
      { message: 'expected object' },
      { message: 'expected number', path: ['a', null as unknown as string, 'b'] },
    ])
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException('an internal reason for the refusal')
  }

  @Get('teapot')
  teapot(): never {
    throw new HttpException('short and stout', 418)
  }

  @Get('internal')
  internal(): never {
    throw new AppError('INTERNAL', 'the database is away', { attempt: 3 })
  }

  @Get('unknown')
  unknown(): never {
    throw new Error('a leak of internal detail')
  }

  @Get('thrown-string')
  thrownString(): never {
    thrown('boom')
  }

  @Get('thrown-null')
  thrownNull(): never {
    thrown(null)
  }
}

@Module({ controllers: [BoomController] })
class BoomModule {}

/** What `app.inject()` resolves to, as far as these tests read it. */
interface Injected {
  readonly statusCode: number
  readonly headers: Readonly<Record<string, unknown>>
  readonly payload: string
}

/** A line the filter wrote through pino, parsed back. */
interface ErrorLine {
  level: number
  context?: string
  code?: string
  requestId?: string
  attempt?: number
  err?: unknown
}

const production = new AppConfig(
  EnvSchema.parse({
    NODE_ENV: 'production',
    LOG_LEVEL: 'error',
    DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/d',
    REDIS_URL: 'redis://127.0.0.1:6379/0',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_BUCKET: 'b',
    S3_ACCESS_KEY_ID: 'k',
    S3_SECRET_ACCESS_KEY: 's',
  }),
)

/**
 * The production options at `error` level — so only what the filter writes
 * is captured, never pino-http's request lines — paired with a capturing
 * stream, through the provider token the module's own factory fills.
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

function createApp(moduleRef: TestingModule, filter: ProblemFilter): NestFastifyApplication {
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )
  app.useGlobalFilters(filter)
  return app
}

async function start(app: NestFastifyApplication): Promise<void> {
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
}

// Strict: a member outside the contract — a `stack`, a `message` — fails
// here instead of being stripped before any `toEqual` could see it.
const StrictProblemDetailsSchema = ProblemDetailsSchema.strict()

/** The body parsed back, after checking the media type and the contract. */
function problem(res: Injected): ProblemDetails {
  expect(res.headers['content-type']).toContain('application/problem+json')
  return StrictProblemDetailsSchema.parse(JSON.parse(res.payload))
}

describe('ProblemFilter in production', () => {
  const lines: string[] = []
  let app: NestFastifyApplication

  // ConfigModule and LoggerModule are what make `request.id` the validated
  // inbound x-request-id or a UUID — without them Fastify ignores the header
  // and counts `req-N` — and, as in main.ts, Nest's Logger, which the filter
  // writes through, is pointed at pino: here, into `lines`.
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, LoggerModule, BoomModule],
    })
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(capturingParams(lines))
      .compile()
    app = createApp(moduleRef, new ProblemFilter('production'))
    app.useLogger(app.get(Logger))
    await start(app)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    lines.length = 0
  })

  function errorLines(): ErrorLine[] {
    return lines.map((line) => JSON.parse(line) as ErrorLine)
  }

  it('renders an AppError as RFC 9457 with the right media type', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom/notfound' })
    expect(res.statusCode).toBe(404)
    expect(problem(res)).toMatchObject({
      type: 'urn:problem:CATALOG_BRAND_NOT_FOUND',
      title: 'Brand Not Found',
      status: 404,
      code: 'CATALOG_BRAND_NOT_FOUND',
      detail: 'no such brand',
    })
  })

  it('carries an instance id taken from the request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/boom/conflict',
      headers: { 'x-request-id': 'req-xyz' },
    })
    expect(res.statusCode).toBe(409)
    expect(problem(res)).toMatchObject({ code: 'CATALOG_BRAND_SLUG_TAKEN', instance: 'req-xyz' })
  })

  // The id Fastify assigned, not the raw header: an inbound id that is not a
  // plain token was replaced with a UUID before the filter ever saw it.
  it('never echoes a rejected x-request-id as instance', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/boom/conflict',
      headers: { 'x-request-id': 'not a token' },
    })
    expect(problem(res).instance).toMatch(UUID_V4)
  })

  it('maps an unknown throw to 500 INTERNAL and leaks nothing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/boom/unknown',
      headers: { 'x-request-id': 'req-500' },
    })
    expect(res.statusCode).toBe(500)
    // Exactly these members: no message, no stack, no stray field.
    expect(problem(res)).toEqual({
      type: 'urn:problem:INTERNAL',
      title: 'Internal Server Error',
      status: 500,
      instance: 'req-500',
      code: 'INTERNAL',
    })
    expect(res.payload).not.toContain('a leak of internal detail')
    // A stack frame would name this file.
    expect(res.payload).not.toContain('problem.test.ts')
  })

  // The stack has to go somewhere: Nest's own filter no longer runs once
  // this one matches, and pino-http's request line only says "failed with
  // status code 500".
  it('writes the unknown throw to the log with its stack, where it belongs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/boom/unknown',
      headers: { 'x-request-id': 'req-500' },
    })
    expect(res.payload).not.toContain('problem.test.ts')

    expect(errorLines()).toHaveLength(1)
    expect(errorLines()[0]).toMatchObject({
      level: 50,
      context: 'ProblemFilter',
      code: 'INTERNAL',
      requestId: 'req-500',
      err: {
        message: 'a leak of internal detail',
        stack: expect.stringContaining('problem.test.ts') as string,
      },
    })
  })

  it('logs an AppError 500 with its meta', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom/internal' })
    expect(res.statusCode).toBe(500)
    expect(problem(res)).toMatchObject({ status: 500, code: 'INTERNAL' })

    expect(errorLines()).toHaveLength(1)
    expect(errorLines()[0]).toMatchObject({
      code: 'INTERNAL',
      attempt: 3,
      err: { message: 'the database is away' },
    })
  })

  it('logs nothing for a 4xx', async () => {
    await app.inject({ method: 'GET', url: '/boom/notfound' })
    await app.inject({ method: 'GET', url: '/boom/forbidden' })
    await app.inject({ method: 'GET', url: '/nope' })
    expect(errorLines()).toHaveLength(0)
  })

  it('maps a thrown string and a thrown null to the same clean 500', async () => {
    for (const url of ['/boom/thrown-string', '/boom/thrown-null']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(500)
      expect(problem(res)).toEqual({
        type: 'urn:problem:INTERNAL',
        title: 'Internal Server Error',
        status: 500,
        instance: expect.any(String) as string,
        code: 'INTERNAL',
      })
      expect(res.payload).not.toContain('boom')
    }
    expect(errorLines().map((line) => line.err)).toEqual(['boom', null])
  })

  it('maps an unmatched route to 404 NOT_FOUND without reflecting the URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/nope',
      headers: { 'x-request-id': 'req-404' },
    })
    expect(res.statusCode).toBe(404)
    expect(problem(res)).toEqual({
      type: 'urn:problem:NOT_FOUND',
      title: 'Not Found',
      status: 404,
      instance: 'req-404',
      code: 'NOT_FOUND',
    })
  })

  it("maps an HttpException to its status's generic code and drops its message", async () => {
    const res = await app.inject({ method: 'GET', url: '/boom/forbidden' })
    expect(res.statusCode).toBe(403)
    expect(problem(res)).toMatchObject({ title: 'Forbidden', status: 403, code: 'FORBIDDEN' })
    expect(res.payload).not.toContain('an internal reason for the refusal')
  })

  // A status with no code of its own keeps its status — a readiness 503 must
  // stay a 503 — and falls back to the generic code.
  it('keeps the status of an HttpException it has no code for', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom/teapot' })
    expect(res.statusCode).toBe(418)
    expect(problem(res)).toMatchObject({ status: 418, code: 'INTERNAL' })
    expect(res.payload).not.toContain('short and stout')
    expect(errorLines()).toHaveLength(0)
  })

  it('serializes ValidationError issues as dotted paths', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom/invalid' })
    expect(res.statusCode).toBe(400)
    const body = problem(res)
    expect(body).toMatchObject({
      title: 'Validation Failed',
      code: 'VALIDATION_FAILED',
      detail: 'Request validation failed',
    })
    expect(body.errors).toEqual([
      { path: 'items.0.sku', message: 'expected string' },
      { path: '', message: 'expected object' },
      { path: 'a.null.b', message: 'expected number' },
    ])
    expect(res.payload).not.toContain('[object Object]')
  })
})

describe('ProblemFilter outside production', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [BoomModule] }).compile()
    app = createApp(moduleRef, new ProblemFilter('development'))
    // @nestjs/testing's TestingLogger prints `error` lines, and this app is
    // about to produce some.
    app.useLogger(false)
    await start(app)
  })

  afterAll(async () => {
    await app.close()
  })

  it('names the cause of an unknown throw, still without a stack', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom/unknown' })
    expect(res.statusCode).toBe(500)
    expect(problem(res)).toMatchObject({ code: 'INTERNAL', detail: 'a leak of internal detail' })
    expect(res.payload).not.toContain('problem.test.ts')
  })

  it('names a thrown string and a thrown null the way String() does', async () => {
    expect(problem(await app.inject({ method: 'GET', url: '/boom/thrown-string' })).detail).toBe(
      'boom',
    )
    expect(problem(await app.inject({ method: 'GET', url: '/boom/thrown-null' })).detail).toBe(
      'null',
    )
  })
})
