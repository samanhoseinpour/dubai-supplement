// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrast, hexToRgb, mix, oklchToHex, toHex, type Rgb } from './helpers/color'

const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8')

function block(pattern: RegExp): Record<string, string> {
  const body = pattern.exec(css)?.[1]
  if (body === undefined) throw new Error(`token block not found: ${String(pattern)}`)
  const tokens: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--([a-z][a-z0-9-]*):\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) tokens[name] = value.trim()
  }
  return tokens
}

// The first @theme block closes at the first `}` that starts a line.
const primitives = block(/@theme\s*\{([\s\S]*?)\n\}/)
const light = block(/:root,\s*\[data-theme=['"]light['"]\]\s*\{([^}]*)\}/)
const dark = block(/\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/)

const IRIS = hexToRgb(primitives['color-iris'] ?? '')
const FROZEN = hexToRgb(primitives['color-frozen'] ?? '')
const PAPER = hexToRgb('#fafafc')
const WHITE = hexToRgb('#ffffff')

type Tokens = Record<string, string>

function solid(tokens: Tokens, name: string): Rgb {
  const value = tokens[name]
  if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(
      `--${name} must be a solid six-digit hex (spec §5.1), got: ${value ?? 'nothing'}`,
    )
  }
  return hexToRgb(value)
}

function alpha(tokens: Tokens, name: string): { alpha: number; over: (bg: Rgb) => Rgb } {
  const match = /^color-mix\(in srgb, var\(--color-(iris|frozen)\) (\d+)%, transparent\)$/.exec(
    tokens[name] ?? '',
  )
  if (!match)
    throw new Error(
      `--${name} must be color-mix(in srgb, var(--color-iris|frozen) N%, transparent)`,
    )
  const ink = match[1] === 'iris' ? IRIS : FROZEN
  const fraction = Number(match[2]) / 100
  return { alpha: fraction, over: (bg) => mix(ink, bg, fraction) }
}

describe('primitives', () => {
  it('are Black Iris and Frozen (D9)', () => {
    expect(toHex(IRIS)).toBe('#080813')
    expect(toHex(FROZEN)).toBe('#a0bddb')
  })

  it('delete every default scale a third colour or size could hide in (§5.1)', () => {
    for (const ns of ['color', 'text', 'radius', 'shadow', 'ease', 'animate', 'font-weight']) {
      expect(css).toContain(`--${ns}-*: initial`)
    }
  })

  it('never use oklch (the shadcn theme was replaced)', () => {
    expect(css).not.toMatch(/oklch\(/)
  })
})

// Tailwind 4's published palette, as OKLCH and as the hex it ships. Three of
// the four lie slightly outside sRGB; reproducing them exactly is what proves
// the helper clamps the way Tailwind encodes.
describe('oklchToHex', () => {
  it.each<[number, number, number, string]>([
    [0.577, 0.245, 27.325, '#e7000b'],
    [0.546, 0.245, 262.881, '#155dfc'],
    [0.627, 0.194, 149.214, '#00a63e'],
    [0.666, 0.179, 58.318, '#e17100'],
  ])('oklch(%s %s %s) is %s', (L, C, h, hex) => {
    expect(oklchToHex(L, C, h)).toBe(hex)
  })
})

describe('light tokens are derived, not typed (§5.2)', () => {
  it.each<[string, Rgb]>([
    ['background', PAPER],
    ['foreground', IRIS],
    ['card', WHITE],
    ['card-foreground', IRIS],
    ['popover', WHITE],
    ['popover-foreground', IRIS],
    ['primary', FROZEN],
    ['primary-foreground', IRIS],
    ['secondary', mix(IRIS, PAPER, 0.06)],
    ['secondary-foreground', IRIS],
    ['muted', mix(IRIS, PAPER, 0.04)],
    ['muted-foreground', mix(IRIS, PAPER, 0.62)],
    ['accent', mix(FROZEN, PAPER, 0.24)],
    ['accent-foreground', IRIS],
    ['destructive', hexToRgb('#b3261e')],
    ['destructive-foreground', WHITE],
    ['ring', IRIS],
  ])('--%s', (name, expected) => {
    expect(toHex(solid(light, name))).toBe(toHex(expected))
  })

  it('carries alpha only on the two non-text tokens, at 12% and 48%', () => {
    expect(alpha(light, 'border').alpha).toBe(0.12)
    expect(alpha(light, 'input').alpha).toBe(0.48)
    for (const [name, value] of Object.entries(light)) {
      if (value.startsWith('color-mix')) expect(['border', 'input']).toContain(name)
    }
  })
})

describe('dark tokens are derived, not typed (§5.3)', () => {
  it.each<[string, Rgb]>([
    ['background', IRIS],
    ['foreground', FROZEN],
    ['card', mix(FROZEN, IRIS, 0.06)],
    ['card-foreground', FROZEN],
    ['popover', mix(FROZEN, IRIS, 0.06)],
    ['popover-foreground', FROZEN],
    ['primary', FROZEN],
    ['primary-foreground', IRIS],
    ['secondary', mix(FROZEN, IRIS, 0.12)],
    ['secondary-foreground', FROZEN],
    ['muted', mix(FROZEN, IRIS, 0.08)],
    ['muted-foreground', mix(FROZEN, IRIS, 0.7)],
    ['accent', mix(FROZEN, IRIS, 0.18)],
    ['accent-foreground', FROZEN],
    ['destructive', hexToRgb('#f28b82')],
    ['destructive-foreground', IRIS],
    ['ring', FROZEN],
  ])('--%s', (name, expected) => {
    expect(toHex(solid(dark, name))).toBe(toHex(expected))
  })

  it('carries alpha only on the two non-text tokens, at 16% and 52%', () => {
    expect(alpha(dark, 'border').alpha).toBe(0.16)
    expect(alpha(dark, 'input').alpha).toBe(0.52)
    for (const [name, value] of Object.entries(dark)) {
      if (value.startsWith('color-mix')) expect(['border', 'input']).toContain(name)
    }
  })
})

const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'card'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'background'],
  ['destructive', 'card'],
]

describe.each<[string, Tokens]>([
  ['light', light],
  ['dark', dark],
])('%s contrast (WCAG 1.4.3 and 1.4.11)', (_theme, tokens) => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(solid(tokens, fg), solid(tokens, bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['background', 'card'])('the control boundary over %s is at least 3:1', (bg) => {
    const surface = solid(tokens, bg)
    expect(contrast(alpha(tokens, 'input').over(surface), surface)).toBeGreaterThanOrEqual(3)
  })

  it('the focus ring over the page is at least 3:1', () => {
    expect(contrast(solid(tokens, 'ring'), solid(tokens, 'background'))).toBeGreaterThanOrEqual(3)
  })

  it('every surface token has its text partner', () => {
    for (const name of Object.keys(tokens)) {
      if (name.endsWith('foreground') || ['border', 'input', 'ring'].includes(name)) continue
      const partner = name === 'background' ? 'foreground' : `${name}-foreground`
      expect(tokens[partner], `--${name} has no --${partner}`).toBeDefined()
    }
  })
})

describe('the fill that does not invert (§5.3)', () => {
  it('keeps primary and its label byte-identical across themes', () => {
    expect(light['primary']).toBe(dark['primary'])
    expect(light['primary-foreground']).toBe(dark['primary-foreground'])
  })
})
