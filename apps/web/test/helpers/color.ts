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

/**
 * OKLCH → sRGB hex, channels clamped to the gamut. The signal colours (§5)
 * are defined as OKLCH triples and committed as hex; this is how the test
 * re-derives them. Matrices: Björn Ottosson, "A perceptual color space for
 * image processing", 2020.
 */
export function oklchToHex(L: number, C: number, h: number): string {
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear: Rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const encode = (c: number): number => {
    const v = Math.min(1, Math.max(0, c))
    return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
  }
  return toHex([encode(linear[0]), encode(linear[1]), encode(linear[2])])
}
