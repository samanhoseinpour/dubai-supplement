import { defineConfig, devices } from '@playwright/test'

// Foundation §7.9 and spec §10.2. In 3a only the web server runs; 3c adds
// the API. Chromium only — the mobile project is a Chromium device, so CI
// installs one browser.
const baseURL = 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm start',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { PORT: '3000' },
  },
})
