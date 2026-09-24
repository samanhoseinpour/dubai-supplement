import { defineConfig } from 'vitest/config'

/**
 * The storage test alone, against whatever S3 endpoint the operator exports —
 * no Docker, no Testcontainers, no global setup. This is what
 * docs/runbooks/first-deploy.md §6 points at Liara once, before the first
 * real upload.
 *
 * The operator supplies only `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`
 * and `S3_SECRET_ACCESS_KEY` (`S3_REGION` and `S3_FORCE_PATH_STYLE` have
 * schema defaults). Everything below is the rest of the environment, which
 * ConfigModule validates as a whole while it is being decorated — so
 * `S3_*` on its own cannot boot the module at all, whatever the test touches.
 * Each store sits on a closed port because this suite must not reach one:
 * the module graph here is ConfigModule plus StorageModule, and neither
 * opens a Postgres or Redis connection.
 *
 * Nothing under `S3_` may be named here. `env` is merged OVER process.env
 * when a worker is forked, so a key listed here would silently overwrite the
 * operator's shell — which is the entire input this config exists to carry.
 */
export default defineConfig({
  test: {
    root: './',
    include: ['test/integration/storage.test.ts'],
    clearMocks: true,
    testTimeout: 60_000,
    env: {
      LOG_LEVEL: 'fatal',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://dubaisupp:dubaisupp@127.0.0.1:1/dubaisupp',
      REDIS_URL: 'redis://127.0.0.1:1/0',
    },
  },
})
