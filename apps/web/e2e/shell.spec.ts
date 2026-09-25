import { expect, test } from '@playwright/test'
import { copy } from '@/lib/copy'

test.describe('the shell', () => {
  test('renders right-to-left Persian in Vazirmatn with the four landmarks', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('dir', 'rtl')
    await expect(html).toHaveAttribute('lang', 'fa')

    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return [...document.fonts].some(
        (font) => /vazirmatn/i.test(font.family) && font.status === 'loaded',
      )
    })
    expect(loaded).toBe(true)

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('navigation', { name: copy.nav.primary })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })

  test('the skip link is first in the tab order and moves focus to main', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: copy.skipToContent })
    await expect(skip).toBeFocused()
    await skip.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })

  test('the footer year is Persian digits', async ({ page }) => {
    await page.goto('/')
    const footer = await page.getByRole('contentinfo').textContent()
    expect(footer).toMatch(/[۰-۹]{4}/)
    expect(footer).not.toMatch(/[0-9]/)
  })
})
