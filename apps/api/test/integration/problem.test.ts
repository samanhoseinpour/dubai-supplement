import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Module,
  type ModuleMetadata,
} from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { type ProblemDetails, ProblemDetailsSchema } from '@ds/contracts'
import { ConfigModule } from '../../src/infra/config/index.js'
import { ProblemFilter } from '../../src/infra/http/problem.filter.js'
import { LoggerModule } from '../../src/infra/logger/index.js'
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors/index.js'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

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
    // `{ key }` segments (spec §5.5). One issue without a path at all.
    throw new ValidationError([
      { message: 'expected string', path: ['items', 0, { key: 'sku' }] },
      { message: 'expected object' },
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

  @Get('unknown')
  unknown(): never {
    throw new Error('a leak of internal detail')
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

async function boot(
  filter: ProblemFilter,
  imports: NonNullable<ModuleMetadata['imports']>,
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports }).compile()
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )
  app.useGlobalFilters(filter)
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}

/** The body parsed back, after checking the media type and the contract. */
function problem(res: Injected): ProblemDetails {
  expect(res.headers['content-type']).toContain('application/problem+json')
  return ProblemDetailsSchema.parse(JSON.parse(res.payload))
}

describe('ProblemFilter in production', () => {
  let app: NestFastifyApplication

  // ConfigModule and LoggerModule are what make `request.id` the validated
  // inbound x-request-id or a UUID; without them Fastify ignores the header
  // and counts `req-N`, and `instance` would carry a meaningless value.
  beforeAll(async () => {
    app = await boot(new ProblemFilter('production'), [ConfigModule, LoggerModule, BoomModule])
  })

  afterAll(async () => {
    await app.close()
  })

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
    const res = await app.inject({ method: 'GET', url: '/boom/unknown' })
    expect(res.statusCode).toBe(500)
    // Exactly these members: no message, no stack, no stray field.
    expect(problem(res)).toEqual({
      type: 'urn:problem:INTERNAL',
      title: 'Internal Server Error',
      status: 500,
      instance: expect.any(String) as string,
      code: 'INTERNAL',
    })
    expect(res.payload).not.toContain('a leak of internal detail')
    // A stack frame would name this file.
    expect(res.payload).not.toContain('problem.test.ts')
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
    ])
    expect(res.payload).not.toContain('[object Object]')
  })
})

describe('ProblemFilter outside production', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await boot(new ProblemFilter('development'), [BoomModule])
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
})
