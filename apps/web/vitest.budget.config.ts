import { defineConfig } from 'vitest/config'

// Runs after `next build` (turbo: web#budget dependsOn build). Kept out of
// vitest.config.ts so `pnpm test` needs no build.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/budget.test.ts'],
    clearMocks: true,
  },
})
