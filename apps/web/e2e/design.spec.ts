import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator } from '@playwright/test'

// D16: WCAG 2.2 AA. Foundation §7.9's two tags reach WCAG 2.0 only.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * The computed border colour as 8-bit channels plus a two-decimal alpha.
 * Chromium serialises a `color-mix()` result as `color(srgb r g b / a)`, never
 * in the legacy `rgba()` form the solid tokens take; the colour is what the
 * assertion is about, so either serialisation reads the same.
 */
function borderTopColor(locator: Locator): Promise<number[] | null> {
  return locator.evaluate((element) => {
    const value = getComputedStyle(element).borderTopColor
    const modern = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(value)
    const legacy = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(value)
    const match = modern ?? legacy
    if (!match) return null
    const scale = modern ? 255 : 1
    const [, r = '', g = '', b = '', a = '1'] = match
    return [
      ...[r, g, b].map((channel) => Math.round(Number(channel) * scale)),
      Math.round(Number(a) * 100) / 100,
    ]
  })
}

test.describe('/design (spec §10.2)', () => {
  test('has no axe violation at WCAG 2.2 AA', async ({ page }) => {
    await page.goto('/design')
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(results.violations).toEqual([])
  })

  test('every marked control is at least 44 by 44 CSS pixels (spec §9, Fitts)', async ({
    page,
  }) => {
    await page.goto('/design')
    const boxes = await page.locator('[data-target]').evaluateAll((elements) =>
      elements.map((element) => {
        const { width, height } = element.getBoundingClientRect()
        return { width, height, text: element.textContent.trim().slice(0, 24) }
      }),
    )
    expect(boxes.length).toBeGreaterThan(10)
    for (const box of boxes) {
      expect(box.width, `${box.text} width`).toBeGreaterThanOrEqual(44)
      expect(box.height, `${box.text} height`).toBeGreaterThanOrEqual(44)
    }
  })

  test('the tokens reach the DOM', async ({ page }) => {
    await page.goto('/design')
    await expect(page.locator('[data-variant="primary"]').first()).toHaveCSS(
      'background-color',
      'rgb(160, 189, 219)',
    )
    // The hand-written rules read the raw tokens — `.skeleton` reads `--muted`
    // and `* { border-color: var(--border) }` — which jsdom cannot see.
    await expect(page.locator('.skeleton').first()).toHaveCSS(
      'background-color',
      'rgb(240, 240, 243)',
    )
    const edge = page.locator('#colors li', { hasText: /^border$/ })
    // Iris at 12 % (§5.2).
    expect(await borderTopColor(edge)).toEqual([8, 8, 19, 0.12])
    await expect(page.locator('body')).toHaveCSS('letter-spacing', 'normal')
    const features = await page
      .locator('html')
      .evaluate((el) => getComputedStyle(el).fontFeatureSettings)
    expect(features).toContain('"ss01"')
    const sizes = await page
      .locator('input')
      .evaluateAll((inputs) =>
        inputs.map((input) => Number.parseFloat(getComputedStyle(input).fontSize)),
      )
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16)
  })

  test('reduced motion stills the shimmer and drops the press transform (spec §7.4)', async ({
    page,
  }) => {
    await page.goto('/design')
    const skeleton = page.locator('.skeleton').first()
    const pressable = page.locator('[data-variant="primary"]').first()
    await expect(skeleton).toHaveCSS('animation-name', 'shimmer')
    expect(await pressable.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain(
      'transform',
    )

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(skeleton).toHaveCSS('animation-name', 'none')
    expect(await pressable.evaluate((el) => getComputedStyle(el).transitionProperty)).not.toContain(
      'transform',
    )
  })
})
