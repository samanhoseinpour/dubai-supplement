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
const LAPIS = hexToRgb(primitives['color-lapis'] ?? '')
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
  const match = /^color-mix\(in srgb, var\(--color-(iris|lapis)\) (\d+)%, transparent\)$/.exec(
    tokens[name] ?? '',
  )
  if (!match)
    throw new Error(`--${name} must be color-mix(in srgb, var(--color-iris|lapis) N%, transparent)`)
  const ink = match[1] === 'iris' ? IRIS : LAPIS
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
  it('are Black Iris and Lapis (D9, ADR-0020)', () => {
    expect(toHex(IRIS)).toBe('#080813')
    // Lapis follows the signal inks' rule: L 0.50, hue 255, chroma 0.15.
    expect(toHex(LAPIS)).toBe(oklchToHex(0.5, 0.15, 255))
    expect(primitives['color-frozen']).toBeUndefined()
  })

  it('delete every default scale a third colour or size could hide in (§5.1)', () => {
    for (const ns of ['color', 'text', 'radius', 'shadow', 'ease', 'animate', 'font-weight']) {
      expect(css).toContain(`--${ns}-*: initial`)
    }
  })

  it('never use oklch (the CSS stays hex; only this test computes it)', () => {
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

// §5.2 — the signal inks: hue per signal (red 28, green 150, amber 65),
// lightness 0.50, chroma the largest hundredth that stays 0.01 inside sRGB,
// capped at 0.18. Lapis (hue 255, chroma 0.15) is the same rule.
const RED = hexToRgb(oklchToHex(0.5, 0.18, 28))
const GREEN = hexToRgb(oklchToHex(0.5, 0.12, 150))
const AMBER = hexToRgb(oklchToHex(0.5, 0.1, 65))

/** A `-soft` surface: the ink pre-mixed at 12 % over the card. */
const soft = (ink: Rgb): Rgb => mix(ink, WHITE, 0.12)

describe('the tokens are derived, not typed (§5.2)', () => {
  it.each<[string, Rgb]>([
    ['background', PAPER],
    ['foreground', IRIS],
    ['card', WHITE],
    ['card-foreground', IRIS],
    ['popover', WHITE],
    ['popover-foreground', IRIS],
    ['primary', IRIS],
    ['primary-foreground', PAPER],
    ['secondary', mix(LAPIS, PAPER, 0.12)],
    ['secondary-foreground', LAPIS],
    ['muted', mix(IRIS, PAPER, 0.04)],
    ['muted-foreground', mix(IRIS, PAPER, 0.62)],
    ['accent', mix(LAPIS, PAPER, 0.16)],
    ['accent-foreground', LAPIS],
    ['destructive', RED],
    ['destructive-foreground', PAPER],
    ['destructive-soft', soft(RED)],
    ['sale', RED],
    ['sale-foreground', PAPER],
    ['success', GREEN],
    ['success-foreground', PAPER],
    ['success-soft', soft(GREEN)],
    ['warning', AMBER],
    ['warning-foreground', PAPER],
    ['warning-soft', soft(AMBER)],
    ['link', LAPIS],
    ['ring', LAPIS],
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
  // `::selection` is the foreground on the accent tint (§5.2).
  ['foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['destructive', 'destructive-soft'],
  ['sale-foreground', 'sale'],
  ['sale', 'background'],
  ['sale', 'card'],
  ['success-foreground', 'success'],
  ['success', 'background'],
  ['success', 'card'],
  ['success', 'success-soft'],
  ['warning-foreground', 'warning'],
  ['warning', 'background'],
  ['warning', 'card'],
  ['warning', 'warning-soft'],
  ['link', 'background'],
  ['link', 'card'],
]

// Tokens that carry no text and pair with nothing: the two edges, the ring
// and the link ink.
const UNPAIRED = ['border', 'input', 'ring', 'link']

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
      if (name.endsWith('foreground') || UNPAIRED.includes(name)) continue
      // A soft surface carries its own ink, not a `-foreground` (§5.2).
      const partner =
        name === 'background'
          ? 'foreground'
          : name.endsWith('-soft')
            ? name.slice(0, -'-soft'.length)
            : `${name}-foreground`
      expect(tokens[partner], `--${name} has no --${partner}`).toBeDefined()
    }
  })
})

describe('the primary is the ink (ADR-0020)', () => {
  it('fills with the foreground and labels with the background', () => {
    expect(tokens['primary']).toBe(tokens['foreground'])
    expect(tokens['primary-foreground']).toBe(tokens['background'])
  })
})

describe('Lapis is an ink and a surface (ADR-0020)', () => {
  it.each(['secondary-foreground', 'accent-foreground', 'ring', 'link'])('is --%s', (name) => {
    expect(toHex(solid(name))).toBe(toHex(LAPIS))
  })

  it('is the secondary at 12 % and the accent at 16 % over paper', () => {
    expect(toHex(solid('secondary'))).toBe(toHex(mix(LAPIS, PAPER, 0.12)))
    expect(toHex(solid('accent'))).toBe(toHex(mix(LAPIS, PAPER, 0.16)))
  })

  it('is never a fill under a -foreground', () => {
    for (const [name, value] of Object.entries(tokens)) {
      if (value === toHex(LAPIS)) {
        expect(['secondary-foreground', 'accent-foreground', 'ring', 'link'], name).toContain(name)
      }
    }
  })
})

describe('the sale red is the destructive red on purpose (§5.2)', () => {
  it('shares both tokens', () => {
    expect(tokens['sale']).toBe(tokens['destructive'])
    expect(tokens['sale-foreground']).toBe(tokens['destructive-foreground'])
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
