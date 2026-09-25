import type { Db } from '../../../infra/db/index.js'
import type { Brand } from '../domain/brand.js'

export type PageInput = { readonly page: number; readonly pageSize: number }
export type BrandPage = { readonly items: readonly Brand[]; readonly total: number }

/**
 * The port (§5.3). `tx` is explicit (§6.4): a write takes the caller's
 * transaction; a read may run on the pool. An abstract class rather than an
 * interface so Nest can use it as the injection token that
 * catalog.module.ts binds to the Drizzle adapter. No decorator: the port
 * owes nothing to the framework.
 */
export abstract class BrandRepository {
  abstract insert(brand: Brand, tx: Db): Promise<void>
  abstract findBySlug(slug: string, tx?: Db): Promise<Brand | null>
  abstract list(page: PageInput, tx?: Db): Promise<BrandPage>
}
