import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: './',
    // Unit only. Everything under test/integration/** needs Docker and runs
    // under vitest.integration.config.ts, so this suite stays runnable with
    // no daemon and no stores (§9.4 rule 3). `test/*.test.ts` is deliberately
    // one level deep: it picks up test/boundaries.test.ts, which reads config
    // files and needs nothing running, and cannot reach test/integration/**.
    include: ['src/**/*.test.ts', 'test/*.test.ts'],
    clearMocks: true,
    // A complete, schema-valid environment with every store on a closed port.
    // `ConfigModule.forRoot({ envFilePath: '.env', validate })` runs while the
    // module is decorated, so merely importing the config barrel — which
    // src/infra/logger/logger.module.test.ts does — validates the environment;
    // without this the suite passes only on a machine that has apps/api/.env,
    // and CI has none. LOG_LEVEL keeps an application boot's pino output off
    // stdout: a test that reads log lines sets its own level.
    env: {
      LOG_LEVEL: 'fatal',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://dubaisupp:dubaisupp@127.0.0.1:1/dubaisupp',
      REDIS_URL: 'redis://127.0.0.1:1/0',
      S3_ENDPOINT: 'http://127.0.0.1:1',
      S3_BUCKET: 'dubaisupp',
      S3_ACCESS_KEY_ID: 'rustfsadmin',
      S3_SECRET_ACCESS_KEY: 'rustfsadmin',
    },
  },
})
