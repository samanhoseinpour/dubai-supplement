import { describe, expect, it } from 'vitest'
import { newId } from './index.js'

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('returns a version 7 UUID', () => {
    expect(newId()).toMatch(V7)
  })

  // uuid ≥ 11 keeps v7 ids monotonic inside one millisecond, which is what
  // makes a primary-key index over them append-mostly (ADR-0004).
  it('never repeats and sorts in generation order', () => {
    const ids = Array.from({ length: 200 }, () => newId())
    expect(new Set(ids).size).toBe(200)
    expect([...ids].sort()).toEqual(ids)
  })
})
