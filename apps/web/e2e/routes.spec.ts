import { expect, test } from '@playwright/test'
import { copy } from '@/lib/copy'

test.describe('routes', () => {
  test('/health answers 200 ok (foundation §7.5)', async ({ request }) => {
    const response = await request.get('/health')
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('an unknown URL is a Persian 404 that is not indexed (foundation §7.6)', async ({
    page,
  }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole('heading', { level: 1, name: copy.errors.notFoundTitle }),
    ).toBeVisible()
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: copy.actions.backHome })).toHaveAttribute(
      'href',
      '/',
    )
  })

  test('/robots.txt is served (foundation §7.7)', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toMatch(/User-Agent: \*/i)
    expect(text).toMatch(/Allow: \//)
  })

  test('/design is not indexed (D14)', async ({ page }) => {
    await page.goto('/design')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})
