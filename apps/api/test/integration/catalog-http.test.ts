import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { OpenAPIObject, ReferenceObject, SchemaObject } from '@nestjs/swagger'
import { BrandListResponseSchema, BrandSchema, ProblemDetailsSchema } from '@ds/contracts'
import { createApp } from '../../src/app.factory.js'
import { AppConfig } from '../../src/infra/config/index.js'
import { DRIZZLE, type Db } from '../../src/infra/db/index.js'
import { BrandService } from '../../src/modules/catalog/index.js'
import { buildDocument } from '../../src/shared/openapi/index.js'
import { resetDb } from '../setup/fixture.js'
import { flushRedis } from '../setup/truncate.js'

const FA_ORDER = ['اپتیموم نوتریشن', 'بی‌اس‌ان', 'دایماتایز', 'ماسل‌تک', 'مای‌پروتئین', 'نوترکس']
const SIX = [
  { slug: 'nutrex', name: 'نوترکس' },
  { slug: 'muscletech', name: 'ماسل‌تک' },
  { slug: 'optimum-nutrition', name: 'اپتیموم نوتریشن' },
  { slug: 'myprotein', name: 'مای‌پروتئین' },
  { slug: 'bsn', name: 'بی‌اس‌ان' },
  { slug: 'dymatize', name: 'دایماتایز' },
]

const isRef = (value: object): value is ReferenceObject => '$ref' in value

/** The `application/json` schema of one GET response, ref or inline. */
function responseSchema(
  doc: OpenAPIObject,
  path: string,
  status: string,
): SchemaObject | ReferenceObject | undefined {
  const response = doc.paths[path]?.get?.responses[status]
  if (response === undefined || isRef(response)) return undefined
  return response.content?.['application/json']?.schema
}

/** Follows `#/components/schemas/<name>` once; `.meta({ id })` may or may not produce a ref (plan deviation 10). */
function deref(
  doc: OpenAPIObject,
  schema: SchemaObject | ReferenceObject | undefined,
): SchemaObject | undefined {
  if (schema === undefined) return undefined
  if (isRef(schema)) {
    const target = doc.components?.schemas?.[schema.$ref.replace('#/components/schemas/', '')]
    return target === undefined || isRef(target) ? undefined : target
  }
  return schema
}

// The production wiring, as app.factory.test.ts boots it: the validation
// pipe, ProblemFilter, the Redis throttle. Isolation is the fixture's
// truncation plus a Redis flush so throttle counters never carry over.
describe('the catalog routes', () => {
  // The handle teardown closes is optional, as outbox.test.ts's fixture is:
  // a boot that throws leaves nothing to close.
  let booted: NestFastifyApplication | undefined
  let app: NestFastifyApplication
  let db: Db

  beforeAll(async () => {
    booted = await createApp()
    app = booted
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    db = app.get<Db>(DRIZZLE)
  })

  afterAll(async () => {
    await booted?.close()
  })

  beforeEach(async () => {
    await resetDb(db)
    await flushRedis(app.get(AppConfig).redisUrl)
    const brands = app.get(BrandService)
    for (const input of SIX) await brands.create(input)
  })

  describe('GET /catalog/brands', () => {
    it('lists the six brands in Persian order inside the page envelope', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands' })
      expect(res.statusCode).toBe(200)
      const body = BrandListResponseSchema.strict().parse(res.json())
      expect(body.total).toBe(6)
      expect(body.items.map((b) => b.name)).toEqual(FA_ORDER)
    })

    // Review Focus 2.
    it('pages, and answers an empty page past the end with the true total', async () => {
      const second = await app.inject({ method: 'GET', url: '/catalog/brands?page=2&pageSize=4' })
      expect(second.statusCode).toBe(200)
      const body = BrandListResponseSchema.parse(second.json())
      expect(body).toMatchObject({ page: 2, pageSize: 4, total: 6 })
      expect(body.items.map((b) => b.name)).toEqual(FA_ORDER.slice(4))
      const past = await app.inject({ method: 'GET', url: '/catalog/brands?page=99' })
      expect(past.statusCode).toBe(200)
      expect(past.json()).toMatchObject({ items: [], page: 99, pageSize: 20, total: 6 })
    })

    it('rejects an invalid query as a 400 problem naming the member', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands?pageSize=101' })
      expect(res.statusCode).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
      const problem = ProblemDetailsSchema.parse(res.json())
      expect(problem.code).toBe('VALIDATION_FAILED')
      expect(problem.errors?.[0]?.path).toBe('pageSize')
    })
  })

  describe('GET /catalog/brands/:slug', () => {
    it('returns the brand with its ZWNJ intact', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands/muscletech' })
      expect(res.statusCode).toBe(200)
      const brand = BrandSchema.strict().parse(res.json())
      expect(brand.name).toBe('ماسل‌تک')
      expect(brand.name).toContain('\u200c')
      expect(brand).not.toHaveProperty('description')
    })

    it('answers 404 CATALOG_BRAND_NOT_FOUND as problem+json for an unknown slug', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands/no-such-brand' })
      expect(res.statusCode).toBe(404)
      expect(res.headers['content-type']).toContain('application/problem+json')
      expect(ProblemDetailsSchema.parse(res.json())).toMatchObject({
        code: 'CATALOG_BRAND_NOT_FOUND',
        status: 404,
        title: 'Brand Not Found',
      })
    })

    // Review Focus 1: malformed is 400, never 404.
    it('answers 400 naming slug for a slug that is not lowercase Latin', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands/MuscleTech' })
      expect(res.statusCode).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
      const problem = ProblemDetailsSchema.parse(res.json())
      expect(problem.code).toBe('VALIDATION_FAILED')
      expect(problem.errors?.[0]?.path).toBe('slug')
    })

    // Fastify's router refuses a parameter longer than its default 100
    // characters with a bare 414 before Nest runs; app.factory.ts raises the
    // cap so the contract's .max(64) answers instead, as the same 400 problem.
    it('answers 400 naming slug, not a bare 414, for a slug over 100 characters', async () => {
      const res = await app.inject({ method: 'GET', url: `/catalog/brands/${'a'.repeat(101)}` })
      expect(res.statusCode).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
      const problem = ProblemDetailsSchema.parse(res.json())
      expect(problem.code).toBe('VALIDATION_FAILED')
      expect(problem.errors?.[0]?.path).toBe('slug')
    })
  })

  describe('the OpenAPI document', () => {
    it('documents both routes with the brand shapes', () => {
      const doc = buildDocument(app)
      expect(Object.keys(doc.paths)).toEqual(
        expect.arrayContaining(['/catalog/brands', '/catalog/brands/{slug}']),
      )
      const item = deref(doc, responseSchema(doc, '/catalog/brands/{slug}', '200'))
      expect(Object.keys(item?.properties ?? {}).sort()).toEqual([
        'createdAt',
        'description',
        'id',
        'name',
        'slug',
        'updatedAt',
      ])
      const list = deref(doc, responseSchema(doc, '/catalog/brands', '200'))
      expect(Object.keys(list?.properties ?? {}).sort()).toEqual([
        'items',
        'page',
        'pageSize',
        'total',
      ])
      expect(deref(doc, responseSchema(doc, '/catalog/brands/{slug}', '404'))?.required).toEqual([
        'type',
        'title',
        'status',
        'instance',
        'code',
      ])
    })
  })
})
