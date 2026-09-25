import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Module } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { Db } from '../../src/infra/db/index.js'
import { EventPublisher } from '../../src/infra/outbox/index.js'
import { BrandRepository } from '../../src/modules/catalog/application/brand.repository.js'
import { BrandService } from '../../src/modules/catalog/application/brand.service.js'
import { DrizzleBrandRepository } from '../../src/modules/catalog/infrastructure/brand.repository.js'
import { withDb, type DbFixture } from '../setup/fixture.js'

/** Fails the way a real publisher does: a rejected promise, after the row is written. */
const failingPublisher: EventPublisher = {
  publish: () => Promise.reject(new Error('publish failed')),
}

// The real service over the real repository, the Drizzle adapter bound to the
// port as catalog.module.ts binds it; only the publisher is swapped. That is
// why CatalogModule is not booted here: it brings OutboxModule's publisher.
@Module({
  providers: [
    BrandService,
    { provide: BrandRepository, useClass: DrizzleBrandRepository },
    { provide: EventPublisher, useValue: failingPublisher },
  ],
})
class FailingPublisherModule {}

describe('BrandService.create', () => {
  let fixture: DbFixture | undefined
  let db: Db
  let service: BrandService

  beforeAll(async () => {
    fixture = await withDb(FailingPublisherModule)
    db = fixture.db
    service = fixture.app.get(BrandService)
  })

  afterAll(async () => {
    await fixture?.close()
  })

  beforeEach(async () => {
    await fixture?.reset()
  })

  // The seam the reference slice exists to prove (§6.4). The unit test shows
  // both ports are handed one `tx`; this shows that `tx` is a real transaction
  // whose failure takes the row with it. A `create` split into two
  // transactions commits the insert before the publish fails, and the row
  // survives — every other suite still passes then, because on success both
  // writes land either way.
  it('rolls the brand row back when its created event cannot be written', async () => {
    await expect(service.create({ slug: 'nutrex', name: 'نوترکس' })).rejects.toThrow(
      'publish failed',
    )
    const res = await db.execute(sql`select count(*)::int as n from brands`)
    expect(res.rows[0]).toEqual({ n: 0 })
  })
})
