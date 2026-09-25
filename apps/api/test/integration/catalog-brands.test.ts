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

  // The six names above land in FA_ORDER under `fa`, under code point and
  // under this image's `en_US.utf8` default alike, so they cannot tell whether
  // `collate "fa"` is in the ORDER BY. This pair can: و (U+0648) precedes
  // ه (U+0647) in the Persian alphabet, while code point, `C` and `en_US.utf8`
  // all put ه first — the pair migrate.test.ts pins on the collation itself,
  // here through the repository's ORDER BY. Inserted in the order every
  // other ordering would list them, so insertion order cannot pass it either.
  it('orders by the fa collation, not by code point or the database default', async () => {
    await insertAll([
      { slug: 'hardcore', name: 'هاردکور' },
      { slug: 'weider', name: 'ویدر' },
    ])
    const page = await repo.list({ page: 1, pageSize: 20 })
    expect(page.items.map((b) => b.name)).toEqual(['ویدر', 'هاردکور'])
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
  // (uniqueness is on the slug) with one search_text. ICU's `fa` orders this
  // pair itself — the space has a primary weight and the ZWNJ is ignorable,
  // so the space form sorts first. `id` never decides here, because with a
  // deterministic collation only byte-identical names can tie, which the
  // next test pins. The ZWNJ form is inserted first, so insertion order
  // would list them the other way round.
  it('keeps two names that differ only by ZWNJ as two rows with one search_text', async () => {
    await insertAll([
      { slug: 'muscletech', name: 'ماسل‌تک' },
      { slug: 'muscle-tech', name: 'ماسل تک' },
    ])
    const res = await db.execute(sql`select count(distinct search_text)::int as n from brands`)
    expect(res.rows[0]).toEqual({ n: 1 })
    const page = await repo.list({ page: 1, pageSize: 20 })
    expect(page.items.map((b) => b.slug)).toEqual(['muscle-tech', 'muscletech'])
  })

  // The `, id` half of §5.7's ORDER BY. Two brands may share a byte-identical
  // name (uniqueness is on the slug), and Postgres's top-N sort is not stable,
  // so without the tie-break such a brand can land on two pages or on none.
  // The higher id is inserted first, so heap order and id order disagree; ids
  // compare as strings because lowercase hex sorts the way Postgres sorts uuid.
  it('breaks a byte-identical name tie by id, so LIMIT/OFFSET pages stay stable', async () => {
    const one = Brand.create({ slug: 'weider', name: 'ویدر' })
    const two = Brand.create({ slug: 'weider-global', name: 'ویدر' })
    const [lower, higher]: [Brand, Brand] = one.id < two.id ? [one, two] : [two, one]
    for (const brand of [higher, lower]) {
      await db.transaction((tx) => repo.insert(brand, tx))
    }
    const first = await repo.list({ page: 1, pageSize: 1 })
    const second = await repo.list({ page: 2, pageSize: 1 })
    expect(first.items.map((b) => b.id)).toEqual([lower.id])
    expect(second.items.map((b) => b.id)).toEqual([higher.id])
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
