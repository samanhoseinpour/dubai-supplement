import { describe, expect, it } from 'vitest'
import { newId } from './ids.js'

describe('newId', () => {
  it('returns a v7 UUID', () => {
    // Version nibble is the 15th hex digit; v7 also sorts by creation time,
    // which is why it is chosen over v4 for primary keys.
    expect(newId()[14]).toBe('7')
  })

  it('is monotonic enough to sort by creation order', async () => {
    const first = newId()
    await new Promise((r) => setTimeout(r, 2))
    expect(newId() > first).toBe(true)
  })

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()))
    expect(ids.size).toBe(1000)
  })
})
