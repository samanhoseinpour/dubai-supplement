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
 */
export function normalizePersian(value: string): string {
  return value
    .replace(ARABIC_YEH, 'ی')
    .replace(ARABIC_KAF, 'ک')
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - PERSIAN_ZERO))
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
}

export function toAsciiDigits(value: string): string {
  return value
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - PERSIAN_ZERO))
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
}

export function toPersianDigits(value: string): string {
  return value.replace(ASCII_DIGITS, (d) => String.fromCodePoint(PERSIAN_ZERO + Number(d)))
}
