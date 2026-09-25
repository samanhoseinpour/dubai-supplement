import type { Brand } from './brand.js'

export const BRAND_CREATED = 'catalog.brand.created' as const

/**
 * Structurally a `DomainEvent` (infra/outbox), declared here so the domain
 * owns its events without importing infrastructure (plan deviation 1).
 * `EventPublisher.publish` accepts it because the shapes agree; if they ever
 * drift, BrandService fails to typecheck — the right place to find out.
 */
export type BrandCreated = {
  readonly type: typeof BRAND_CREATED
  readonly aggregateType: 'Brand'
  readonly aggregateId: string
  readonly payload: { id: string; slug: string; name: string }
  readonly occurredAt: Date
}

export function brandCreated(brand: Brand, occurredAt: Date = brand.createdAt): BrandCreated {
  return {
    type: BRAND_CREATED,
    aggregateType: 'Brand',
    aggregateId: brand.id,
    payload: { id: brand.id, slug: brand.slug, name: brand.name },
    occurredAt,
  }
}
