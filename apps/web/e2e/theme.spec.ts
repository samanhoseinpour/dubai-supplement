import { expect, test, type Page } from '@playwright/test'
import { copy } from '@/lib/copy'

const html = (page: Page) => page.locator('html')

async function choose(page: Page, option: string) {
  await page.getByRole('button', { name: copy.theme.label }).first().click()
  await page.getByRole('menuitemradio', { name: option }).click()
  // Task 7's review: every choice also proves `closeOnClick`.
  await expect(page.getByRole('menu')).toHaveCount(0)
}

test.describe('theme (spec §5.6)', () => {
  test('is light by default, even when the OS prefers dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    await expect(html(page)).toHaveCSS('color-scheme', 'light')
  })

  test('a chosen dark theme survives a reload and ignores the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await choose(page, copy.theme.dark)
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(html(page)).toHaveCSS('color-scheme', 'dark')
    await page.reload()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  })

  test('the system option follows the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await choose(page, copy.theme.system)
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
  })

  test('the menu popup is right-to-left — the first portal (spec §8.1)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: copy.theme.label }).first().click()
    const popup = page.getByRole('menu')
    await expect(popup).toBeVisible()
    await expect(popup).toHaveCSS('direction', 'rtl')
    await expect(page.getByRole('menuitemradio')).toHaveCount(3)
  })

  test('an unknown stored value still renders light and can be changed (Review Focus 2)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('ds-theme', 'blue')
    })
    await page.goto('/')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 252)')
    await choose(page, copy.theme.dark)
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(8, 8, 19)')
  })
})
