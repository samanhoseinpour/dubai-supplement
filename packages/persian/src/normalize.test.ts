import { describe, expect, it } from 'vitest'
import { normalizePersian, toAsciiDigits, toPersianDigits } from './normalize.js'

describe('normalizePersian', () => {
  it('rewrites Arabic yeh and kaf to their Persian forms', () => {
    // U+064A ARABIC YEH -> U+06CC FARSI YEH, U+0643 ARABIC KAF -> U+06A9 KEHEH
    expect(normalizePersian('يك')).toBe('یک')
  })

  it('folds Persian and Arabic-Indic digits to ASCII', () => {
    expect(normalizePersian('۱۲۳')).toBe('123')
    expect(normalizePersian('٠١٢')).toBe('012')
  })

  it('preserves ZWNJ, which carries meaning in Persian compounds', () => {
    // «ماسل‌تک» — the brand name in the Phase 3 seed. Losing U+200C here
    // would silently rewrite six catalogue entries.
    const withZwnj = 'ماسل‌تک'
    expect(normalizePersian(withZwnj)).toContain('‌')
  })

  it('leaves already-normal text untouched', () => {
    expect(normalizePersian('کتاب')).toBe('کتاب')
  })
})

describe('digit helpers', () => {
  it('round-trips ASCII to Persian and back', () => {
    expect(toPersianDigits('2026')).toBe('۲۰۲۶')
    expect(toAsciiDigits('۲۰۲۶')).toBe('2026')
  })
})
