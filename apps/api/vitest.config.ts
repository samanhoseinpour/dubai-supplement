import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: './',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    clearMocks: true,
    // Application boots in tests log through pino to stdout; keep the run's
    // output to vitest's own. A test that reads log lines sets its own level.
    env: { LOG_LEVEL: 'fatal' },
  },
})
