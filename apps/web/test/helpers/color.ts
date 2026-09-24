export type Rgb = readonly [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const digits = match?.[1]
  if (digits === undefined) throw new Error(`not a six-digit hex colour: ${hex}`)
  const n = Number.parseInt(digits, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** `fg` mixed over `bg` at fraction `p` in sRGB — the spec's "X% over Y" (§5.1). */
export function mix(fg: Rgb, bg: Rgb, p: number): Rgb {
  const channel = (i: 0 | 1 | 2) => Math.round(bg[i] + (fg[i] - bg[i]) * p)
  return [channel(0), channel(1), channel(2)]
}

function linear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2.x contrast ratio; the order of the arguments does not matter. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
