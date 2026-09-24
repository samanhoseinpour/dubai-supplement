import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: './',
    // The unit suite (vitest.config.ts) is src/**; this project owns
    // test/integration/** and is the only one that needs Docker (§9.4).
    include: ['test/integration/**/*.test.ts'],
    globalSetup: ['./test/setup/containers.ts'],
    // Containers are shared across files, so files must not run in parallel
    // (§6.6). `sequential` was removed in Vitest 5; this is its replacement.
    fileParallelism: false,
    clearMocks: true,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Merged over process.env when a worker is forked, so this is where a
    // value the containers do not own gets pinned and the developer's own
    // apps/api/.env stops deciding anything. LOG_LEVEL keeps the run's
    // output vitest's own; TRUST_PROXY is the list app.factory.test.ts
    // asserts the adapter trusts. Nothing the global setup writes may be
    // named here — this object wins over it.
    env: { LOG_LEVEL: 'fatal', TRUST_PROXY: 'loopback,uniquelocal' },
  },
})
