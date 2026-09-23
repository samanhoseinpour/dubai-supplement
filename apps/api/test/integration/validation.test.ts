import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import {
  Body,
  Controller,
  Get,
  type LoggerService,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { z } from 'zod'
import { id, PageQuerySchema, type ProblemDetails, ProblemDetailsSchema } from '@ds/contracts'
import { buildValidationPipe, ProblemFilter } from '../../src/infra/http/index.js'

/** A body fixture, not a contract: one required member and nothing else. */
const CreateThingSchema = z.object({ name: z.string().min(1) })

const A_UUID = '6f1e8f6a-3f2b-4c1d-9e7a-2b3c4d5e6f70'

@Controller('things')
class ThingsController {
  @Get()
  list(@Query({ schema: PageQuerySchema }) query: { page: number; pageSize: number }) {
    return query
  }

  // Echoes what the pipe handed the handler, so a test sees exactly what
  // survived validation rather than only that the request was accepted.
  @Post()
  create(@Body({ schema: CreateThingSchema }) body: { name: string }) {
    return body
  }

  @Get(':id')
  get(@Param('id', { schema: id }) thingId: string) {
    return { id: thingId }
  }
}

/** The positive control for the logging test: a 500 the filter must log. */
@Controller('boom')
class BoomController {
  @Get()
  boom(): never {
    throw new Error('positive control')
  }
}

@Module({ controllers: [ThingsController, BoomController] })
class ThingsModule {}

/** What `app.inject()` resolves to, as far as these tests read it. */
interface Injected {
  readonly statusCode: number
  readonly headers: Readonly<Record<string, unknown>>
  readonly payload: string
}

// Strict: a member outside the contract fails here instead of being stripped.
const StrictProblemDetailsSchema = ProblemDetailsSchema.strict()

/** The 400 body parsed back, after checking the media type and the contract. */
function problem(res: Injected): ProblemDetails {
  expect(res.statusCode).toBe(400)
  expect(res.headers['content-type']).toContain('application/problem+json')
  return StrictProblemDetailsSchema.parse(JSON.parse(res.payload))
}

describe('global validation', () => {
  /** Every `error` call made through Nest's Logger — the filter's only log line. */
  const errorCalls: unknown[][] = []
  const spyLogger: LoggerService = {
    log: () => undefined,
    warn: () => undefined,
    error: (...args: unknown[]) => {
      errorCalls.push(args)
    },
  }
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ThingsModule] }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    )
    app.useGlobalPipes(buildValidationPipe())
    app.useGlobalFilters(new ProblemFilter('test'))
    // The filter writes through whatever `useLogger` installed: here a spy,
    // so the logging test can count its calls and the 500 it provokes never
    // reaches the console.
    app.useLogger(spyLogger)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    errorCalls.length = 0
  })

  it('coerces query strings and applies defaults', async () => {
    const res = await app.inject({ method: 'GET', url: '/things?page=2' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({ page: 2, pageSize: 20 })
  })

  it('rejects a non-numeric page as a 400 problem with a field error', async () => {
    const res = await app.inject({ method: 'GET', url: '/things?page=abc' })
    expect(res.statusCode).toBe(400)
    expect(res.headers['content-type']).toContain('application/problem+json')
    const body = problem(res)
    expect(body.code).toBe('VALIDATION_FAILED')
    expect(body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'page' })]))
  })

  it('names the offending field, not [object Object]', async () => {
    // Guards the issue-path normalization in ProblemFilter: a path rendered
    // through a bare String() over object segments produces "[object Object]".
    const res = await app.inject({ method: 'GET', url: '/things?pageSize=999' })
    const body = problem(res)
    expect(body.errors?.[0]?.path).toBe('pageSize')
    expect(JSON.stringify(body)).not.toContain('[object Object]')
  })

  it('emits the full problem contract for a rejected query', async () => {
    const res = await app.inject({ method: 'GET', url: '/things?page=abc' })
    expect(problem(res)).toEqual({
      type: 'urn:problem:VALIDATION_FAILED',
      title: 'Validation Failed',
      status: 400,
      instance: expect.any(String) as string,
      code: 'VALIDATION_FAILED',
      detail: 'Request validation failed',
      errors: [{ path: 'page', message: expect.stringContaining('expected number') as string }],
    })
  })

  describe('a body', () => {
    it('is accepted only in the shape the schema declares: undeclared members are dropped', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/things',
        payload: { name: 'whey', role: 'admin' },
      })
      expect(res.statusCode).toBe(201)
      // Exactly `name`: the handler never saw `role`.
      expect(JSON.parse(res.payload)).toEqual({ name: 'whey' })
    })

    it('is rejected when a required member is missing, naming the member', async () => {
      const res = await app.inject({ method: 'POST', url: '/things', payload: {} })
      expect(problem(res)).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ path: 'name', message: expect.stringContaining('expected string') as string }],
      })
    })

    it('is rejected when it is not an object', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/things',
        headers: { 'content-type': 'application/json' },
        payload: '"whey"',
      })
      expect(problem(res)).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ path: '', message: expect.stringContaining('expected object') as string }],
      })
    })

    // No content type, no bytes: Fastify hands the handler `undefined`, and
    // the pipe validates that against the schema like any other value.
    it('is rejected when absent entirely', async () => {
      const res = await app.inject({ method: 'POST', url: '/things' })
      expect(problem(res)).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ path: '', message: expect.stringContaining('received undefined') as string }],
      })
    })

    // JSON declared, no bytes: Fastify's parser refuses it before any pipe
    // runs, and that refusal comes out as the same problem, message dropped.
    it('is rejected when declared as JSON but empty, without echoing the parser', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/things',
        headers: { 'content-type': 'application/json' },
      })
      expect(problem(res)).toEqual({
        type: 'urn:problem:VALIDATION_FAILED',
        title: 'Validation Failed',
        status: 400,
        instance: expect.any(String) as string,
        code: 'VALIDATION_FAILED',
      })
      expect(res.payload).not.toContain('Body cannot be empty')
    })
  })

  describe('a path parameter', () => {
    it('passes through when it satisfies its schema', async () => {
      const res = await app.inject({ method: 'GET', url: `/things/${A_UUID}` })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload)).toEqual({ id: A_UUID })
    })

    it('is rejected when it does not', async () => {
      const res = await app.inject({ method: 'GET', url: '/things/not-a-uuid' })
      expect(problem(res)).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ path: '', message: expect.any(String) as string }],
      })
    })
  })

  describe('logging', () => {
    it('writes nothing for a validation failure, while a 500 still reaches the log', async () => {
      // The control first: proves the spy is the logger the filter writes to.
      const boom = await app.inject({ method: 'GET', url: '/boom' })
      expect(boom.statusCode).toBe(500)
      expect(errorCalls).toHaveLength(1)

      errorCalls.length = 0
      const rejected = await app.inject({ method: 'GET', url: '/things?page=abc' })
      expect(rejected.statusCode).toBe(400)
      expect(errorCalls).toEqual([])
    })
  })
})
