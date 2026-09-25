import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { Db } from '../../src/infra/db/index.js'
import { OutboxRelay } from '../../src/infra/outbox/index.js'
import {
  BrandService,
  CatalogModule,
  SEED_BRANDS,
  seedBrands,
} from '../../src/modules/catalog/index.js'
import { withDb, type DbFixture } from '../setup/fixture.js'

describe('seedBrands', () => {
  let fixture: DbFixture | undefined
  let db: Db
  let brands: BrandService
  let relay: OutboxRelay

  beforeAll(async () => {
    fixture = await withDb(CatalogModule)
    db = fixture.db
    brands = fixture.app.get(BrandService)
    relay = fixture.app.get(OutboxRelay)
  })

  afterAll(async () => {
    await fixture?.close()
  })

  beforeEach(async () => {
    await fixture?.reset()
  })

  async function counts(): Promise<{ brands: number; events: number }> {
    const res = await db.execute(
      sql`select (select count(*)::int from brands) as brands, (select count(*)::int from outbox_events where event_type = 'catalog.brand.created') as events`,
    )
    return res.rows[0] as { brands: number; events: number }
  }

  it('creates the nine brands with their descriptions, once', async () => {
    const report = await seedBrands(brands)
    expect(report.created).toHaveLength(9)
    expect(report.skipped).toEqual([])
    expect(await counts()).toEqual({ brands: 9, events: 9 })
    const nutriversum = await brands.findBySlug('nutriversum')
    expect(nutriversum?.name).toBe('نوتری‌ورسوم')
    expect(nutriversum?.description).toMatch(/^آمینو/)
    // Normalised on write: the fixture's Persian digits are stored as ASCII.
    expect((await brands.findBySlug('7nutrition'))?.description).toContain('100')
  })

  it('writes nothing and emits nothing on a second run', async () => {
    await seedBrands(brands)
    const second = await seedBrands(brands)
    expect(second.created).toEqual([])
    expect(second.skipped).toHaveLength(9)
    expect(await counts()).toEqual({ brands: 9, events: 9 })
  })

  // Review Focus 3: a crashed seed left three rows; the next run fills the gap, once.
  it('completes a partial seed without duplicating rows or events', async () => {
    for (const input of SEED_BRANDS.slice(0, 3)) await brands.create(input)
    const report = await seedBrands(brands)
    expect(report.created).toEqual(SEED_BRANDS.slice(3).map((b) => b.slug))
    expect(report.skipped).toEqual(SEED_BRANDS.slice(0, 3).map((b) => b.slug))
    expect(await counts()).toEqual({ brands: 9, events: 9 })
    const perSlug = await db.execute(
      sql`select payload->>'slug' as slug, count(*)::int as n from outbox_events group by 1 order by 1`,
    )
    expect(perSlug.rows).toHaveLength(9)
    expect(perSlug.rows.every((row) => (row as { n: number }).n === 1)).toBe(true)
  })

  it('delivers every event to the logging handler through the relay', async () => {
    await seedBrands(brands)
    // On Logger's prototype, not on the handler: the relay captured the
    // handler's method when it scanned, but that method looks `log` up on its
    // Logger instance at call time.
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    try {
      await relay.runOnce()
      const res = await db.execute(
        sql`select count(*) filter (where published_at is null)::int as pending, count(*) filter (where last_error is not null)::int as failed from outbox_events`,
      )
      expect(res.rows[0]).toEqual({ pending: 0, failed: 0 })
      // The line above passes with BrandCreatedLogger unregistered, because
      // the relay marks an event nobody handles as published; the handler's
      // own line is what proves delivery. Counted by message rather than with
      // toHaveBeenCalledTimes, since every Logger.log call lands on this spy.
      const delivered = log.mock.calls.filter(
        ([message]: readonly unknown[]) =>
          typeof message === 'object' &&
          message !== null &&
          'msg' in message &&
          message.msg === 'brand created',
      )
      expect(delivered).toHaveLength(9)
    } finally {
      log.mockRestore()
    }
  })
})
