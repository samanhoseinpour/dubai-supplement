import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Module } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { Db } from '../../src/infra/db/index.js'
import { ConflictError } from '../../src/shared/errors/index.js'
import { BrandRepository } from '../../src/modules/catalog/application/brand.repository.js'
import { Brand } from '../../src/modules/catalog/domain/brand.js'
import { DrizzleBrandRepository } from '../../src/modules/catalog/infrastructure/brand.repository.js'
import { withDb, type DbFixture } from '../setup/fixture.js'

@Module({ providers: [{ provide: BrandRepository, useClass: DrizzleBrandRepository }] })
class RepositoryModule {}

/** The six seed names (§5.7) in the order ICU's fa collation puts them. */
const FA_ORDER = ['اپتیموم نوتریشن', 'بی‌اس‌ان', 'دایماتایز', 'ماسل‌تک', 'مای‌پروتئین', 'نوترکس']

/** Deliberately not in that order. */
const SIX = [
  { slug: 'nutrex', name: 'نوترکس' },
  { slug: 'muscletech', name: 'ماسل‌تک' },
  { slug: 'optimum-nutrition', name: 'اپتیموم نوتریشن' },
  { slug: 'myprotein', name: 'مای‌پروتئین' },
  { slug: 'bsn', name: 'بی‌اس‌ان' },
  { slug: 'dymatize', name: 'دایماتایز' },
]

/** pg's SQLSTATE, wherever the driver error sits: on the rejection or behind a `cause`. */
function pgCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const direct = (error as { code?: unknown }).code
  if (typeof direct === 'string') return direct
  return pgCode((error as { cause?: unknown }).cause)
}

describe('DrizzleBrandRepository', () => {
  let fixture: DbFixture | undefined
  let db: Db
  let repo: BrandRepository

  beforeAll(async () => {
    fixture = await withDb(RepositoryModule)
    db = fixture.db
    repo = fixture.app.get(BrandRepository)
  })

  afterAll(async () => {
    await fixture?.close()
  })

  beforeEach(async () => {
    await fixture?.reset()
  })

  async function insertAll(
    inputs: ReadonlyArray<{ slug: string; name: string }>,
  ): Promise<Brand[]> {
    const out: Brand[] = []
    for (const input of inputs) {
      const brand = Brand.create(input)
      await db.transaction((tx) => repo.insert(brand, tx))
      out.push(brand)
    }
    return out
  }

  // Review Focus 4: the row keeps U+200C.
  it('round-trips a brand and keeps the ZWNJ in the stored name', async () => {
    const [brand] = await insertAll([{ slug: 'muscletech', name: 'ماسل‌تک' }])
    const found = await repo.findBySlug('muscletech')
    expect(found?.id).toBe(brand?.id)
    expect(found?.name).toBe('ماسل‌تک')
    expect(found?.name).toContain('‌')
    expect(found?.description).toBeUndefined()
    expect(found?.createdAt).toEqual(brand?.createdAt)
  })

  // §6.3: the generated column turns the ZWNJ into a space, and only there.
  it('derives search_text with the ZWNJ as a space', async () => {
    await insertAll([{ slug: 'muscletech', name: 'ماسل‌تک' }])
    const res = await db.execute(sql`select search_text from brands where slug = 'muscletech'`)
    expect(res.rows[0]).toEqual({ search_text: 'ماسل تک' })
  })

  it('answers null for an unknown slug', async () => {
    await expect(repo.findBySlug('nope')).resolves.toBeNull()
  })

  it('lists in Persian alphabetical order whatever the insertion order', async () => {
    await insertAll(SIX)
    const page = await repo.list({ page: 1, pageSize: 20 })
    expect(page.total).toBe(6)
    expect(page.items.map((b) => b.name)).toEqual(FA_ORDER)
  })

  it('pages with the true total and an empty page past the end', async () => {
    await insertAll(SIX)
    const second = await repo.list({ page: 2, pageSize: 4 })
    expect(second.items.map((b) => b.name)).toEqual(FA_ORDER.slice(4))
    expect(second.total).toBe(6)
    const past = await repo.list({ page: 99, pageSize: 4 })
    expect(past.items).toEqual([])
    expect(past.total).toBe(6)
  })

  it('maps a duplicate slug to CATALOG_BRAND_SLUG_TAKEN', async () => {
    await insertAll([{ slug: 'bsn', name: 'بی‌اس‌ان' }])
    const again = Brand.create({ slug: 'bsn', name: 'بی اس ان' })
    const attempt = db.transaction((tx) => repo.insert(again, tx))
    await expect(attempt).rejects.toBeInstanceOf(ConflictError)
    await expect(attempt).rejects.toMatchObject({ code: 'CATALOG_BRAND_SLUG_TAKEN', status: 409 })
    expect((await repo.list({ page: 1, pageSize: 20 })).total).toBe(1)
  })

  // Review Focus 5: names that differ only by a ZWNJ are two brands
  // (uniqueness is on the slug) with one search_text, listed deterministically.
  it('keeps two names that differ only by ZWNJ as two rows with one search_text', async () => {
    await insertAll([
      { slug: 'muscletech', name: 'ماسل‌تک' },
      { slug: 'muscle-tech', name: 'ماسل تک' },
    ])
    const res = await db.execute(sql`select count(distinct search_text)::int as n from brands`)
    expect(res.rows[0]).toEqual({ n: 1 })
    const page = await repo.list({ page: 1, pageSize: 20 })
    expect(page.items.map((b) => b.slug).sort()).toEqual(['muscle-tech', 'muscletech'])
  })

  // db.md: invariants are constraints. The entity refuses these first; the
  // table refuses them from any path that bypasses it. 23514 is check_violation.
  it('refuses an invalid slug and an empty name at the table', async () => {
    const raw = (slug: string, name: string) =>
      db.execute(
        sql`insert into brands (id, slug, name, created_at, updated_at) values (gen_random_uuid(), ${slug}, ${name}, now(), now())`,
      )
    await expect(raw('MuscleTech', 'نام').catch(pgCode)).resolves.toBe('23514')
    await expect(raw('ok', '').catch(pgCode)).resolves.toBe('23514')
  })
})
