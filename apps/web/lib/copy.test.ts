import { describe, expect, it } from 'vitest'
import { copy, SITE_NAME } from './copy'

// Latin tokens that are allowed to appear in customer-facing copy. A brand
// name is Latin by definition (foundation §7.7 slugs); nothing else is.
const LATIN_ALLOWLIST: readonly string[] = ['MuscleTech']

function leaves(node: unknown, path: string): Array<[string, string]> {
  if (typeof node === 'string') return [[path, node]]
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, `${path}.${key}`))
  }
  throw new Error(`copy holds a non-string at ${path}`)
}

describe('lib/copy', () => {
  const strings = leaves(copy, 'copy')

  it('has strings at every leaf', () => {
    expect(strings.length).toBeGreaterThan(20)
    for (const [path, value] of strings) expect(value.trim(), path).not.toBe('')
  })

  it('carries no Latin letters or ASCII digits outside the allow-list (spec §6.4–§6.5)', () => {
    for (const [path, value] of strings) {
      let text = value
      for (const token of LATIN_ALLOWLIST) text = text.replaceAll(token, '')
      expect(text, path).not.toMatch(/[A-Za-z0-9]/)
    }
  })

  it('names the site once', () => {
    expect(copy.siteName).toBe(SITE_NAME)
    expect(SITE_NAME).toBe('دبی ساپلیمنت')
  })

  it('knows one theme: no toggle, no panels (ADR-0021)', () => {
    expect(copy).not.toHaveProperty('theme')
    expect(copy.design).not.toHaveProperty('panels')
    expect(copy.design.sections).not.toHaveProperty('themeToggle')
    expect(copy.design.intro).toBe('هر جزء در هر حالت. جزئی که اینجا نیست، وجود ندارد.')
  })
})
