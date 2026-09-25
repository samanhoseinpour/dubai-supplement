// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrast, hexToRgb, mix, oklchToHex, toHex, type Rgb } from './helpers/color'

const root = fileURLToPath(new URL('../', import.meta.url))
const css = readFileSync(join(root, 'app/globals.css'), 'utf8')

function block(pattern: RegExp): Record<string, string> {
  const body = pattern.exec(css)?.[1]
  if (body === undefined) throw new Error(`token block not found: ${String(pattern)}`)
  const tokens: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--([a-z][a-z0-9-]*):\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) tokens[name] = value.trim()
  }
  return tokens
}

// The first @theme block closes at the first `}` that starts a line. The
// semantic tokens are the first `:root` block: one theme, no attribute
// (ADR-0021).
const primitives = block(/@theme\s*\{([\s\S]*?)\n\}/)
const tokens = block(/:root\s*\{([^}]*)\}/)

const IRIS = hexToRgb(primitives['color-iris'] ?? '')
const FROZEN = hexToRgb(primitives['color-frozen'] ?? '')
const PAPER = hexToRgb('#fafafc')
const WHITE = hexToRgb('#ffffff')

function solid(name: string): Rgb {
  const value = tokens[name]
  if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(
      `--${name} must be a solid six-digit hex (spec §5.1), got: ${value ?? 'nothing'}`,
    )
  }
  return hexToRgb(value)
}

function alpha(name: string): { alpha: number; over: (bg: Rgb) => Rgb } {
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

/** Every file under `dir`, for the assertions that read the source tree. */
function filesUnder(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .map((file) => join(root, dir, file))
    .filter((file) => statSync(file).isFile())
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

describe('the tokens are derived, not typed (§5.2)', () => {
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
    expect(toHex(solid(name))).toBe(toHex(expected))
  })

  it('carries alpha only on the two non-text tokens, at 12% and 48%', () => {
    expect(alpha('border').alpha).toBe(0.12)
    expect(alpha('input').alpha).toBe(0.48)
    for (const [name, value] of Object.entries(tokens)) {
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

describe('contrast (WCAG 1.4.3 and 1.4.11)', () => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(solid(fg), solid(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['background', 'card'])('the control boundary over %s is at least 3:1', (bg) => {
    const surface = solid(bg)
    expect(contrast(alpha('input').over(surface), surface)).toBeGreaterThanOrEqual(3)
  })

  it('the focus ring over the page is at least 3:1', () => {
    expect(contrast(solid('ring'), solid('background'))).toBeGreaterThanOrEqual(3)
  })

  it('every surface token has its text partner', () => {
    for (const name of Object.keys(tokens)) {
      if (name.endsWith('foreground') || ['border', 'input', 'ring'].includes(name)) continue
      const partner = name === 'background' ? 'foreground' : `${name}-foreground`
      expect(tokens[partner], `--${name} has no --${partner}`).toBeDefined()
    }
  })
})

describe('there is one theme (ADR-0021)', () => {
  it('keeps the tokens on :root, in the light colour scheme', () => {
    expect(css).toMatch(/:root\s*\{\s*color-scheme: light;/)
  })

  it('has no theme attribute, no dark variant and no colour-scheme query', () => {
    expect(css).not.toMatch(/data-theme/)
    expect(css).not.toMatch(/@custom-variant dark/)
    expect(css).not.toMatch(/prefers-color-scheme/)
  })

  it('names next-themes nowhere under apps/web', () => {
    // This file names it in the assertion below, so it judges every file but
    // itself.
    const self = fileURLToPath(import.meta.url)
    const files = ['app', 'components', 'lib', 'e2e', 'test'].flatMap(filesUnder)
    expect(files.length).toBeGreaterThan(20)
    for (const file of files) {
      if (file === self) continue
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/next-themes/)
    }
  })
})
