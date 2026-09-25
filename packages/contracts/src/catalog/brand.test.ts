import { describe, expect, it } from 'vitest'
import { BrandListQuerySchema, BrandListResponseSchema, BrandSchema } from './brand.js'

const A_BRAND = {
  id: '0199f3c0-1111-7000-8000-000000000000',
  slug: 'muscletech',
  name: 'ماسل‌تک',
  createdAt: '2026-09-25T12:00:00.000Z',
  updatedAt: '2026-09-25T12:00:00.000Z',
}

describe('BrandSchema', () => {
  it('accepts the wire shape and keeps the ZWNJ in the name', () => {
    const parsed = BrandSchema.parse(A_BRAND)
    expect(parsed.name).toBe('ماسل‌تک')
    expect(parsed.name).toContain('‌')
    expect(parsed.description).toBeUndefined()
  })

  it('normalises Arabic letters in the name through persianText', () => {
    expect(BrandSchema.parse({ ...A_BRAND, name: 'يك' }).name).toBe('یک')
  })

  it('rejects a slug that is not lowercase Latin', () => {
    expect(() => BrandSchema.parse({ ...A_BRAND, slug: 'MuscleTech' })).toThrow()
    expect(() => BrandSchema.parse({ ...A_BRAND, slug: 'ماسل' })).toThrow()
  })

  // Zod 4.6: z.iso.datetime() requires seconds (contracts.md). The API emits
  // Date#toISOString(), which always carries them; this pins the contract so a
  // hand-built timestamp without seconds fails here, not as a 400 in production.
  it('requires seconds in the timestamps', () => {
    expect(() => BrandSchema.parse({ ...A_BRAND, createdAt: '2026-09-25T12:00Z' })).toThrow()
    expect(BrandSchema.parse({ ...A_BRAND, createdAt: new Date(0).toISOString() }).createdAt).toBe(
      '1970-01-01T00:00:00.000Z',
    )
  })

  it('caps the name at 200 and the description at 2000 code points', () => {
    expect(() => BrandSchema.parse({ ...A_BRAND, name: 'آ'.repeat(201) })).toThrow()
    expect(BrandSchema.parse({ ...A_BRAND, name: 'آ'.repeat(200) }).name).toHaveLength(200)
    expect(() => BrandSchema.parse({ ...A_BRAND, description: 'آ'.repeat(2001) })).toThrow()
    expect(
      BrandSchema.parse({ ...A_BRAND, description: 'آ'.repeat(2000) }).description,
    ).toHaveLength(2000)
  })

  it('names itself and the list envelope for the OpenAPI document', () => {
    expect(BrandSchema.meta()?.id).toBe('Brand')
    expect(BrandListResponseSchema.meta()?.id).toBe('BrandListResponse')
  })
})

describe('BrandListQuerySchema and BrandListResponseSchema', () => {
  it('is the page query, defaults included', () => {
    expect(BrandListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(() => BrandListQuerySchema.parse({ pageSize: '101' })).toThrow()
  })

  it('wraps brands in the page envelope', () => {
    const value = { items: [A_BRAND], page: 1, pageSize: 20, total: 1 }
    expect(BrandListResponseSchema.parse(value)).toEqual(value)
    expect(() =>
      BrandListResponseSchema.parse({ ...value, items: [{ ...A_BRAND, slug: 'X' }] }),
    ).toThrow()
  })
})
