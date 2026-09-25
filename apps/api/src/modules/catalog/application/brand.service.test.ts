import { describe, expect, it } from 'vitest'
import type { Db } from '../../../infra/db/index.js'
import type { DomainEvent, EventPublisher } from '../../../infra/outbox/index.js'
import { NotFoundError } from '../../../shared/errors/index.js'
import type { Brand } from '../domain/brand.js'
import type { BrandPage, BrandRepository, PageInput } from './brand.repository.js'
import { BrandService, toDto } from './brand.service.js'

/** In memory, in insertion order; `tx` is recorded so a test can see it was threaded through. */
class FakeBrandRepository implements BrandRepository {
  readonly rows: Brand[] = []
  readonly seenTx: unknown[] = []

  insert(brand: Brand, tx: Db): Promise<void> {
    this.seenTx.push(tx)
    this.rows.push(brand)
    return Promise.resolve()
  }

  findBySlug(slug: string): Promise<Brand | null> {
    return Promise.resolve(this.rows.find((row) => row.slug === slug) ?? null)
  }

  list({ page, pageSize }: PageInput): Promise<BrandPage> {
    const start = (page - 1) * pageSize
    return Promise.resolve({
      items: this.rows.slice(start, start + pageSize),
      total: this.rows.length,
    })
  }
}

class FakePublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  readonly seenTx: unknown[] = []

  publish(event: DomainEvent, tx: Db): Promise<void> {
    this.seenTx.push(tx)
    this.events.push(event)
    return Promise.resolve()
  }
}

// The one thing the service calls on Db: a transaction that hands the
// callback a marker, so a test can assert the same marker reached both ports.
const TX = { marker: 'tx' } as unknown as Db
const fakeDb = {
  transaction: <T>(fn: (tx: Db) => Promise<T>): Promise<T> => fn(TX),
} as unknown as Db

function makeService() {
  const repo = new FakeBrandRepository()
  const publisher = new FakePublisher()
  return { service: new BrandService(fakeDb, repo, publisher), repo, publisher }
}

describe('BrandService', () => {
  it('creates the brand and its event inside one transaction', async () => {
    const { service, repo, publisher } = makeService()
    const brand = await service.create({ slug: 'muscletech', name: 'ماسل‌تک' })
    expect(repo.rows).toEqual([brand])
    expect(publisher.events).toEqual([
      expect.objectContaining({ type: 'catalog.brand.created', aggregateId: brand.id }),
    ])
    expect(repo.seenTx).toEqual([TX])
    expect(publisher.seenTx).toEqual([TX])
  })

  it('findBySlug answers null and getBySlug throws the catalog 404 for an unknown slug', async () => {
    const { service } = makeService()
    await expect(service.findBySlug('nope')).resolves.toBeNull()
    await expect(service.getBySlug('nope')).rejects.toBeInstanceOf(NotFoundError)
    await expect(service.getBySlug('nope')).rejects.toMatchObject({
      code: 'CATALOG_BRAND_NOT_FOUND',
      status: 404,
    })
  })

  it('lists the page envelope with ISO timestamps and no undefined description key', async () => {
    const { service } = makeService()
    await service.create({ slug: 'bsn', name: 'بی‌اس‌ان' })
    const page = await service.list({ page: 1, pageSize: 20 })
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 1 })
    expect(page.items[0]).not.toHaveProperty('description')
    expect(page.items[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('pages past the end as an empty list with the true total', async () => {
    const { service } = makeService()
    await service.create({ slug: 'bsn', name: 'بی‌اس‌ان' })
    await expect(service.list({ page: 99, pageSize: 20 })).resolves.toEqual({
      items: [],
      page: 99,
      pageSize: 20,
      total: 1,
    })
  })
})

describe('toDto', () => {
  it('carries the description only when there is one', async () => {
    const { service } = makeService()
    const withOne = await service.create({ slug: 'a', name: 'الف', description: 'توضیح' })
    const without = await service.create({ slug: 'b', name: 'ب' })
    expect(toDto(withOne)).toMatchObject({ description: 'توضیح' })
    expect(toDto(without)).not.toHaveProperty('description')
  })
})
