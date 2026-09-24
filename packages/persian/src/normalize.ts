const ARABIC_YEH = /ي/gu
const ARABIC_KAF = /ك/gu
const PERSIAN_DIGITS = /[۰-۹]/gu
const ARABIC_INDIC_DIGITS = /[٠-٩]/gu
const ASCII_DIGITS = /[0-9]/gu

// Both digit blocks sit in the BMP, so every match is a single UTF-16 code
// unit and `charCodeAt(0)` is exact (and typed `number`, unlike `codePointAt`).
const PERSIAN_ZERO = 0x06f0
const ARABIC_INDIC_ZERO = 0x0660

/**
 * Canonical form for Persian text on write (§6.3). Deliberately does NOT
 * touch U+200C ZWNJ: it distinguishes «ماسل‌تک» from «ماسلتک».
 *
 * It does trim, and this is the only place trimming happens. Stored form is
 * decided here or it is decided in several places at once — `@ds/contracts`
 * validating an HTTP body, the domain entity normalizing on write, and every
 * aggregate after Brand — which is the fork this function exists to prevent.
 * Untrimmed, padding reaches slugs, uniqueness comparisons and rendered
 * Persian copy, and it counts toward a schema's declared `.max()`, so the
 * declared limit stops being the limit. No Persian text means anything
 * different for a leading space; ZWNJ is Cf rather than WhiteSpace, so
 * `trim()` cannot reach it.
 */
export function normalizePersian(value: string): string {
  return toAsciiDigits(value.replace(ARABIC_YEH, 'ی').replace(ARABIC_KAF, 'ک')).trim()
}

/**
 * Neither digit helper trims, and neither may start to: both are applied
 * mid-string — over an address line, over rendered copy, over a value a
 * validator is about to pattern-match — where the surrounding characters are
 * the caller's. `validators.ts` trims for itself for exactly that reason.
 */
export function toAsciiDigits(value: string): string {
  return value
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - PERSIAN_ZERO))
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
}

export function toPersianDigits(value: string): string {
  return value.replace(ASCII_DIGITS, (d) => String.fromCodePoint(PERSIAN_ZERO + Number(d)))
}
