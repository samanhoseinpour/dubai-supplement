import { describe, expect, it } from 'vitest'
import { SPRING } from './motion'

describe('SPRING (spec §7.3, apple-design §4)', () => {
  it('has no overshoot by default', () => {
    expect(SPRING.default).toEqual({ type: 'spring', bounce: 0, duration: 0.4 })
  })

  it('reserves bounce for momentum, and keeps it small', () => {
    expect(SPRING.momentum.bounce).toBe(0.2)
    expect(SPRING.sheet.bounce).toBe(0.2)
    expect(SPRING.sheet.duration).toBe(0.3)
  })

  it('never takes longer than Apple’s response of 0.4 s', () => {
    for (const spring of Object.values(SPRING)) expect(spring.duration).toBeLessThanOrEqual(0.4)
  })
})
