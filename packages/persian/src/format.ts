export const TEHRAN_TZ = 'Asia/Tehran' as const

const RIAL_PER_TOMAN = 10n

const numberFormat = new Intl.NumberFormat('fa-IR')
const jalaliShort = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: TEHRAN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const jalaliLong = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: TEHRAN_TZ,
  dateStyle: 'long',
})
const jalaliYear = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: TEHRAN_TZ,
  year: 'numeric',
})

export function formatNumber(value: number | bigint): string {
  return numberFormat.format(value)
}

/**
 * `amountMinorIrr` is rials (§6.3). Integer division truncates on purpose:
 * rounding up would show a customer a price above the one charged.
 */
export function formatToman(amountMinorIrr: bigint): string {
  const toman = amountMinorIrr / RIAL_PER_TOMAN
  return `${numberFormat.format(toman)} تومان`
}

/** Server-side only — formatting on the client risks an ICU hydration mismatch (§7.3). */
export function formatJalali(date: Date, style: 'short' | 'long' = 'short'): string {
  return style === 'long' ? jalaliLong.format(date) : jalaliShort.format(date)
}

/** The Jalali year in Persian digits — «۱۴۰۵» for any instant of 1405, Tehran time. */
export function formatJalaliYear(date: Date): string {
  return jalaliYear.format(date)
}
