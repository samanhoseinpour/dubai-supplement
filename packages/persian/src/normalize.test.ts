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

  // The single authority on stored form is also the single place trimming
  // happens (§6.3). Without it `@ds/contracts` and every Phase 3 domain
  // entity would each have to re-derive it — the fork this function exists
  // to prevent — or carry padding into slugs, uniqueness comparisons and
  // rendered copy. No Persian text means anything different for a leading
  // space.
  it('trims, so padding never reaches storage', () => {
    expect(normalizePersian('  نایک  ')).toBe('نایک')
    expect(normalizePersian('\n\tیک \r\n')).toBe('یک')
    expect(normalizePersian('   ')).toBe('')
  })

  it('does not trim the ZWNJ it preserves', () => {
    // U+200C is not whitespace to String.prototype.trim — it is Cf, not the
    // WhiteSpace production — so the character «ماسل‌تک» depends on survives
    // at either end of the string as well as inside it.
    expect(normalizePersian('\u200cیک\u200c')).toBe('\u200cیک\u200c')
  })
})

describe('digit helpers', () => {
  it('round-trips ASCII to Persian and back', () => {
    expect(toPersianDigits('2026')).toBe('۲۰۲۶')
    expect(toAsciiDigits('۲۰۲۶')).toBe('2026')
  })

  // Deliberately not trimming, unlike normalizePersian: these two are
  // applied mid-string — over an address line, over rendered copy, over a
  // value a validator is about to pattern-match — where the surrounding
  // characters belong to the caller. `validators.ts` trims for itself
  // because of this. Only normalizePersian decides stored form.
  it('leave surrounding whitespace alone', () => {
    expect(toAsciiDigits(' ۱۲۳ ')).toBe(' 123 ')
    expect(toPersianDigits(' 123 ')).toBe(' ۱۲۳ ')
  })
})
