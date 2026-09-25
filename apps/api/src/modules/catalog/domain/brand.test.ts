import { describe, expect, it } from 'vitest'
import { Brand, InvalidBrandError } from './brand.js'
import { BRAND_CREATED, brandCreated } from './events.js'

const NOW = new Date('2026-09-25T12:00:00.000Z')

describe('Brand.create', () => {
  // Review Focus 4: normalised on write, ZWNJ kept.
  it('normalises the name on write and keeps a ZWNJ', () => {
    const brand = Brand.create({ slug: 'muscletech', name: '  ماسل‌تك  ' }, NOW)
    expect(brand.name).toBe('ماسل‌تک')
    expect(brand.name).toContain('‌')
  })

  it('normalises the description too, digits included', () => {
    const brand = Brand.create(
      { slug: 'dymatize', name: 'دایماتایز', description: ' آیزو ۱۰۰ ' },
      NOW,
    )
    expect(brand.description).toBe('آیزو 100')
  })

  it('leaves the description undefined when none is given', () => {
    expect(Brand.create({ slug: 'bsn', name: 'بی‌اس‌ان' }, NOW).description).toBeUndefined()
  })

  it('mints a version 7 id and stamps both timestamps with the same instant', () => {
    const brand = Brand.create({ slug: 'bsn', name: 'بی‌اس‌ان' }, NOW)
    expect(brand.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(brand.id[14]).toBe('7')
    expect(brand.createdAt).toEqual(NOW)
    expect(brand.updatedAt).toEqual(NOW)
  })

  it.each(['MuscleTech', 'muscle_tech', 'ماسل', '', 'a'.repeat(65)])(
    'rejects the slug %j',
    (slug) => {
      expect(() => Brand.create({ slug, name: 'نام' }, NOW)).toThrow(InvalidBrandError)
    },
  )

  it('rejects a name that is empty after normalisation or over 200 code points', () => {
    expect(() => Brand.create({ slug: 'x', name: '   ' }, NOW)).toThrow(InvalidBrandError)
    expect(() => Brand.create({ slug: 'x', name: 'آ'.repeat(201) }, NOW)).toThrow(InvalidBrandError)
    expect(Brand.create({ slug: 'x', name: 'آ'.repeat(200) }, NOW).name).toHaveLength(200)
  })

  it('rejects a description that is blank or over 2000 code points', () => {
    expect(() => Brand.create({ slug: 'x', name: 'نام', description: '  ' }, NOW)).toThrow(
      InvalidBrandError,
    )
    expect(() =>
      Brand.create({ slug: 'x', name: 'نام', description: 'آ'.repeat(2001) }, NOW),
    ).toThrow(InvalidBrandError)
  })
})

describe('Brand.rehydrate', () => {
  it('wraps a stored row without normalising again', () => {
    const props = {
      id: '0199f3c0-1111-7000-8000-000000000000',
      slug: 'nutrex',
      name: 'نوترکس',
      description: undefined,
      createdAt: NOW,
      updatedAt: NOW,
    }
    const brand = Brand.rehydrate(props)
    expect(brand.id).toBe(props.id)
    expect(brand.name).toBe('نوترکس')
  })
})

describe('brandCreated', () => {
  it('describes the aggregate for the outbox', () => {
    const brand = Brand.create({ slug: 'nutrex', name: 'نوترکس' }, NOW)
    expect(brandCreated(brand)).toEqual({
      type: BRAND_CREATED,
      aggregateType: 'Brand',
      aggregateId: brand.id,
      payload: { id: brand.id, slug: 'nutrex', name: 'نوترکس' },
      occurredAt: NOW,
    })
    expect(BRAND_CREATED).toBe('catalog.brand.created')
  })
})
