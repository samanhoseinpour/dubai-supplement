import { describe, expect, it } from 'vitest'
import { TEHRAN_TZ, formatJalali, formatJalaliYear, formatNumber, formatToman } from './format.js'

describe('formatToman', () => {
  it('divides rial minor units by ten and labels the result', () => {
    // 1,500,000 IRR minor units = 150,000 toman
    const out = formatToman(1_500_000n)
    expect(out).toContain('تومان') // تومان
    expect(out).toContain('۱') // Persian digit one
    expect(out).not.toMatch(/[0-9]/) // never ASCII digits in customer-facing output
  })

  it('handles zero', () => {
    expect(formatToman(0n)).toContain('۰')
  })

  it('truncates sub-toman remainders rather than rounding up', () => {
    // 19 rial is 1.9 toman; showing 2 would overstate a price.
    expect(formatToman(19n)).toBe(formatToman(10n))
  })
})

describe('formatJalali', () => {
  it('formats in the Persian calendar, in Tehran time', () => {
    // 2026-03-20T22:00:00Z is 2026-03-21 01:30 in Tehran -> 1 Farvardin 1405
    const out = formatJalali(new Date('2026-03-20T22:00:00Z'))
    expect(out).toContain('۱۴۰۵') // ۱۴۰۵
  })

  it('pins the timezone constant', () => {
    expect(TEHRAN_TZ).toBe('Asia/Tehran')
  })
})

describe('formatNumber', () => {
  it('groups with the Persian separator and Persian digits', () => {
    expect(formatNumber(1234567)).not.toMatch(/[0-9]/)
    expect(formatNumber(1234567)).toContain('٬')
  })
})

describe('formatJalaliYear', () => {
  it('returns the Jalali year in Persian digits', () => {
    expect(formatJalaliYear(new Date('2026-09-25T12:00:00Z'))).toBe('۱۴۰۵')
  })

  it('turns the year over at midnight in Tehran, not in UTC', () => {
    // 1 Farvardin 1405 is 2026-03-21. Tehran is UTC+03:30, so 19:00Z is still
    // 22:30 on 29 Esfand 1404 and 21:00Z is 00:30 on 1 Farvardin 1405.
    expect(formatJalaliYear(new Date('2026-03-20T19:00:00Z'))).toBe('۱۴۰۴')
    expect(formatJalaliYear(new Date('2026-03-20T21:00:00Z'))).toBe('۱۴۰۵')
  })

  it('emits no ASCII digit', () => {
    expect(formatJalaliYear(new Date())).not.toMatch(/[0-9]/)
  })
})
