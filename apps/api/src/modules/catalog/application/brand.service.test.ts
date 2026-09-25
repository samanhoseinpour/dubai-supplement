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

/**
 * The one thing the service calls on Db. Every `transaction` call is counted
 * and hands its callback a marker of its own, so a test can tell one
 * transaction from two: a `create` split in two opens two and gives each port
 * a different marker.
 */
class FakeDb {
  readonly transactions: Db[] = []

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const tx = { marker: 'tx', n: this.transactions.length + 1 } as unknown as Db
    this.transactions.push(tx)
    return fn(tx)
  }
}

function makeService() {
  const db = new FakeDb()
  const repo = new FakeBrandRepository()
  const publisher = new FakePublisher()
  return { service: new BrandService(db as unknown as Db, repo, publisher), db, repo, publisher }
}

describe('BrandService', () => {
  it('creates the brand and its event inside one transaction', async () => {
    const { service, db, repo, publisher } = makeService()
    const brand = await service.create({ slug: 'muscletech', name: 'ماسل‌تک' })
    expect(repo.rows).toEqual([brand])
    expect(publisher.events).toEqual([
      expect.objectContaining({ type: 'catalog.brand.created', aggregateId: brand.id }),
    ])
    // Exactly one transaction, and both ports wrote through it — compared by
    // identity, because every call hands out a marker of its own.
    expect(db.transactions).toHaveLength(1)
    expect(repo.seenTx).toHaveLength(1)
    expect(publisher.seenTx).toHaveLength(1)
    expect(repo.seenTx[0]).toBe(db.transactions[0])
    expect(publisher.seenTx[0]).toBe(repo.seenTx[0])
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
