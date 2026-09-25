import { Inject, Injectable } from '@nestjs/common'
import { count, eq, sql } from 'drizzle-orm'
import { DRIZZLE, type Db } from '../../../infra/db/index.js'
import { ConflictError } from '../../../shared/errors/index.js'
import { BrandRepository, type BrandPage, type PageInput } from '../application/brand.repository.js'
import { Brand } from '../domain/brand.js'
import { brands } from './schema.js'

/** pg's SQLSTATE for a unique violation. */
const UNIQUE_VIOLATION = '23505'

@Injectable()
export class DrizzleBrandRepository extends BrandRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {
    super()
  }

  /** A plain INSERT (§5.7): the unique constraint is the invariant, and its violation is the 409. */
  async insert(brand: Brand, tx: Db): Promise<void> {
    try {
      await tx.insert(brands).values({
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        ...(brand.description === undefined ? {} : { description: brand.description }),
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
      })
    } catch (error) {
      if (isUniqueViolation(error, 'brands_slug_key')) {
        throw new ConflictError(
          'CATALOG_BRAND_SLUG_TAKEN',
          `A brand with the slug "${brand.slug}" already exists`,
        )
      }
      throw error
    }
  }

  async findBySlug(slug: string, tx: Db = this.db): Promise<Brand | null> {
    const rows = await tx.select().from(brands).where(eq(brands.slug, slug)).limit(1)
    const row = rows[0]
    return row === undefined ? null : toEntity(row)
  }

  /** `ORDER BY name COLLATE "fa", id` (§5.7): Persian alphabetical, deterministic on ties. */
  async list({ page, pageSize }: PageInput, tx: Db = this.db): Promise<BrandPage> {
    const rows = await tx
      .select()
      .from(brands)
      .orderBy(sql`${brands.name} collate "fa"`, brands.id)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const totals = await tx.select({ total: count() }).from(brands)
    return { items: rows.map(toEntity), total: totals[0]?.total ?? 0 }
  }
}

function toEntity(row: typeof brands.$inferSelect): Brand {
  return Brand.rehydrate({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

/**
 * pg raises 23505 with the constraint's name. Drizzle 0.45.3 wraps every
 * driver error in a DrizzleQueryError and hangs pg's error on `cause`
 * (pg-core/session.js), so that is where the code sits today; the direct
 * check covers a driver error that reaches here unwrapped.
 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { code?: unknown; constraint?: unknown; cause?: unknown }
  if (e.code === UNIQUE_VIOLATION && e.constraint === constraint) return true
  return isUniqueViolation(e.cause, constraint)
}
