import { describe, expect, it } from 'vitest'
import { PageQuerySchema, id, paginated, persianText, slug } from './index.js'
import { z } from 'zod'

describe('id', () => {
  it('accepts a UUID and rejects other strings', () => {
    const uuid = '0199f3c0-1111-7000-8000-000000000000'
    expect(id.parse(uuid)).toBe(uuid)
    expect(() => id.parse('not-a-uuid')).toThrow()
  })
})

describe('persianText', () => {
  it('normalizes before validating, so Arabic yeh is accepted', () => {
    const parsed = persianText(50).parse('يك')
    expect(parsed).toBe('یک')
  })

  it('counts code points, not UTF-16 units, and charges ZWNJ exactly one', () => {
    // Zod 4.6 changed .max() to code points (§8.1). «ماسل‌تک» is 7 code points.
    const name = 'ماسل‌تک'
    expect(() => persianText(7).parse(name)).not.toThrow()
    expect(() => persianText(6).parse(name)).toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => persianText(50).parse('')).toThrow()
  })

  it('rejects whitespace-only input but never trims what it accepts', () => {
    expect(() => persianText(50).parse('   ')).toThrow()
    expect(persianText(50).parse('یک')).toBe('یک')
    expect(persianText(50).parse(' یک ')).toBe(' یک ')
  })
})

describe('slug', () => {
  it('accepts lowercase Latin with hyphens and rejects anything else', () => {
    expect(slug.parse('optimum-nutrition')).toBe('optimum-nutrition')
    expect(() => slug.parse('Optimum')).toThrow()
    expect(() => slug.parse('ماسل')).toThrow()
  })
})

describe('PageQuerySchema', () => {
  it('defaults, coerces from query strings, and caps pageSize', () => {
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(PageQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 })
    expect(() => PageQuerySchema.parse({ pageSize: '101' })).toThrow()
    expect(() => PageQuerySchema.parse({ page: '0' })).toThrow()
  })
})

describe('paginated', () => {
  it('wraps an item schema with the page envelope', () => {
    const schema = paginated(z.object({ id: z.uuid() }))
    const value = {
      items: [{ id: '0199f3c0-1111-7000-8000-000000000000' }],
      page: 1,
      pageSize: 20,
      total: 1,
    }
    expect(schema.parse(value)).toEqual(value)
    expect(() => schema.parse({ ...value, items: [{ id: 'not-a-uuid' }] })).toThrow()
    expect(() => schema.parse({ ...value, total: -1 })).toThrow()
  })
})
