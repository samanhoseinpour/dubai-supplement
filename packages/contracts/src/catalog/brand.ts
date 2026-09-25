import { z } from 'zod'
import { id, PageQuerySchema, paginated, persianText, slug } from '../common/index.js'

/**
 * The HTTP shape of a brand (foundation §8.1) — never the domain entity.
 * `createdAt` and `updatedAt` are full ISO-8601 with seconds, which Zod 4.6
 * requires and `brand.test.ts` pins. `.meta({ id })` names the schema so the
 * OpenAPI document and the generated client can carry `Brand` as a type.
 */
export const BrandSchema = z
  .object({
    id,
    slug,
    name: persianText(200),
    description: persianText(2000).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Brand' })

export type Brand = z.infer<typeof BrandSchema>

export const BrandListQuerySchema = PageQuerySchema
export type BrandListQuery = z.infer<typeof BrandListQuerySchema>

export const BrandListResponseSchema = paginated(BrandSchema).meta({ id: 'BrandListResponse' })
export type BrandListResponse = z.infer<typeof BrandListResponseSchema>
