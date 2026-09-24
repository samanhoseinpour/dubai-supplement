import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { Body, Controller, Get, Module, Post } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import type { OpenAPIObject, ReferenceObject, SchemaObject } from '@nestjs/swagger'
import { ThrottlerStorage } from '@nestjs/throttler'
import type { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { z } from 'zod'
import { ERROR_CODES, persianText, ProblemDetailsSchema } from '@ds/contracts'
import type * as ConfigBarrel from '../../src/infra/config/index.js'
import { ApiZodResponse, buildDocument } from '../../src/shared/openapi/index.js'

const WidgetSchema = z.object({ id: z.uuid(), label: z.string().max(10) })
const CreateWidgetSchema = z.object({ label: persianText(10) })
type CreateWidget = z.infer<typeof CreateWidgetSchema>

@Controller('widgets')
class WidgetsController {
  @Get()
  @ApiZodResponse(200, WidgetSchema)
  list() {
    return { id: '0199f3c0-1111-7000-8000-000000000000', label: 'w' }
  }

  @Post()
  @ApiZodResponse(201, WidgetSchema)
  @ApiZodResponse(404, ProblemDetailsSchema)
  create(@Body({ schema: CreateWidgetSchema }) body: CreateWidget) {
    return { id: '0199f3c0-2222-7000-8000-000000000000', label: body.label }
  }
}

@Module({ controllers: [WidgetsController] })
class WidgetsModule {}

async function makeApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [WidgetsModule] }).compile()
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )
  await app.init()
  return app
}

const isRef = (value: object): value is ReferenceObject => '$ref' in value

/** The inline `application/json` schema of one response, or undefined. */
function responseSchema(
  doc: OpenAPIObject,
  path: string,
  method: 'get' | 'post',
  status: string,
): SchemaObject | undefined {
  const response = doc.paths[path]?.[method]?.responses[status]
  if (response === undefined || isRef(response)) return undefined
  const schema = response.content?.['application/json']?.schema
  return schema === undefined || isRef(schema) ? undefined : schema
}

/** The inline `application/json` schema of a request body, or undefined. */
function requestBodySchema(doc: OpenAPIObject, path: string): SchemaObject | undefined {
  const body = doc.paths[path]?.post?.requestBody
  if (body === undefined || isRef(body)) return undefined
  const schema = body.content['application/json']?.schema
  return schema === undefined || isRef(schema) ? undefined : schema
}

describe('OpenAPI generation', () => {
  describe('from Zod schemas on a fixture module', () => {
    let app: NestFastifyApplication
    let doc: OpenAPIObject

    beforeAll(async () => {
      app = await makeApp()
      doc = buildDocument(app)
    })

    afterAll(() => app.close())

    it('renders a Zod response schema into the document', () => {
      const schema = responseSchema(doc, '/widgets', 'get', '200')
      expect(schema).toBeDefined()
      expect(Object.keys(schema?.properties ?? {}).sort()).toEqual(['id', 'label'])
    })

    // persianText is a z.preprocess pipe: a transform on the input side. Zod
    // 4.6's generator renders the pipe's output side for input schemas when
    // the input side is a transform, so a request body shows the bounded
    // string a client must send, never an opaque or unrepresentable type
    // (Task 2 carry-forward, settled here).
    it('renders a persianText request body as a bounded string', () => {
      const body = requestBodySchema(doc, '/widgets')
      expect(body?.required).toEqual(['label'])
      expect(body?.properties?.label).toEqual({ type: 'string', minLength: 1, maxLength: 10 })
    })

    it('renders the problem contract as a response, enum and optionals included', () => {
      const problem = responseSchema(doc, '/widgets', 'post', '404')
      expect(problem?.properties?.code).toEqual({ type: 'string', enum: [...ERROR_CODES] })
      expect(problem?.required).toEqual(['type', 'title', 'status', 'instance', 'code'])
    })

    it('leaves components empty, because no schema carries .meta({ id })', () => {
      expect(Object.keys(doc.components?.schemas ?? {})).toEqual([])
    })
  })

  // The boot src/openapi.ts performs: AppModule behind a bare adapter, never
  // listening. `pnpm --filter api openapi` runs in CI with no service
  // containers (§10.1), so nothing here may reach for a store — and every
  // store sits on a closed port to prove it, whichever ones the module graph
  // holds: a pg Pool connects on first query, ioredis is lazyConnect, the S3
  // client is lazy (§5.5). An eager connection anywhere fails the boot here.
  describe('from AppModule, as src/openapi.ts boots it', () => {
    let moduleRef: TestingModule
    let app: NestFastifyApplication
    let doc: OpenAPIObject
    let config: typeof ConfigBarrel

    beforeAll(async () => {
      vi.stubEnv('DATABASE_URL', 'postgres://dubaisupp:dubaisupp@127.0.0.1:1/dubaisupp')
      vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:1/0')
      vi.stubEnv('S3_ENDPOINT', 'http://127.0.0.1:1')
      // ConfigModule validates the environment at import, so AppModule is
      // imported only now, with the stubs in place — and afresh, so a static
      // import of the config elsewhere in this file could not pre-empt them
      // (the config-boot pattern). A process value wins over .env, so the
      // developer's file decides nothing.
      vi.resetModules()
      const { AppModule } = await import('../../src/app.module.js')
      config = await import('../../src/infra/config/index.js')
      moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
      app = moduleRef.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter({ logger: false }),
      )
      await app.init()
      doc = buildDocument(app)
    })

    afterAll(async () => {
      await app.close()
      vi.unstubAllEnvs()
    })

    it('boots and builds the document with every store unreachable', () => {
      // The stubs reached the snapshot the app was built from; without this
      // line, a stub that missed the boot would prove nothing.
      expect(moduleRef.get(config.AppConfig).databaseUrl).toContain('127.0.0.1:1/')
      expect(Object.keys(doc.paths)).toContain('/health/live')
    })

    it('opens no Redis connection', () => {
      // The throttler's client is created with lazyConnect and no request was
      // served, so ioredis has not even attempted to connect: `wait` is the
      // status before the first command or an explicit connect().
      const storage = moduleRef.get<ThrottlerStorageRedisService>(ThrottlerStorage)
      expect(storage.redis.status).toBe('wait')
    })

    it('matches the committed openapi.json', async () => {
      const committed = JSON.parse(
        await readFile(new URL('../../openapi.json', import.meta.url), 'utf8'),
      ) as unknown
      expect(committed).toEqual(doc)
    })
  })
})
