import { Inject, Injectable } from '@nestjs/common'
import type { Brand as BrandDto, BrandListQuery, BrandListResponse } from '@ds/contracts'
import { DRIZZLE, type Db } from '../../../infra/db/index.js'
import { EventPublisher } from '../../../infra/outbox/index.js'
import { NotFoundError } from '../../../shared/errors/index.js'
import { Brand, type CreateBrandInput } from '../domain/brand.js'
import { brandCreated } from '../domain/events.js'
import { BrandRepository } from './brand.repository.js'

@Injectable()
export class BrandService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly brands: BrandRepository,
    private readonly events: EventPublisher,
  ) {}

  async list(query: BrandListQuery): Promise<BrandListResponse> {
    const { items, total } = await this.brands.list(query)
    return { items: items.map(toDto), page: query.page, pageSize: query.pageSize, total }
  }

  /** `null` for "not there" — what the seed asks. */
  findBySlug(slug: string): Promise<Brand | null> {
    return this.brands.findBySlug(slug)
  }

  /** The 404 the controller lets through to ProblemFilter — what a route asks. */
  async getBySlug(slug: string): Promise<Brand> {
    const brand = await this.brands.findBySlug(slug)
    if (brand === null) {
      throw new NotFoundError('CATALOG_BRAND_NOT_FOUND', `No brand has the slug "${slug}"`)
    }
    return brand
  }

  /**
   * Used by the seed and by tests — there is no HTTP route (§5.7). The row
   * and its outbox event land in one transaction (§6.4); a duplicate slug
   * surfaces as the repository's ConflictError and rolls both back.
   */
  async create(input: CreateBrandInput): Promise<Brand> {
    const brand = Brand.create(input)
    await this.db.transaction(async (tx) => {
      await this.brands.insert(brand, tx)
      await this.events.publish(brandCreated(brand), tx)
    })
    return brand
  }
}

/** The entity as the HTTP shape (§8.1): ISO strings, and no `description` key when there is none. */
export function toDto(brand: Brand): BrandDto {
  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    ...(brand.description === undefined ? {} : { description: brand.description }),
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  }
}
