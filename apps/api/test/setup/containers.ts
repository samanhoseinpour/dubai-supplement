import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers'
import type { TestProject } from 'vitest/node'

/** What the containers produced, as the tests receive it. */
export interface ContainerEnv {
  readonly databaseUrl: string
  readonly redisUrl: string
  readonly s3Endpoint: string
}

declare module 'vitest' {
  export interface ProvidedContext {
    containers: ContainerEnv
  }
}

const run = promisify(execFile)

let postgres: StartedPostgreSqlContainer | undefined
let redis: StartedTestContainer | undefined
let rustfs: StartedTestContainer | undefined

/**
 * Started once per run, before any worker is forked — vitest computes a
 * worker's environment from `process.env` when it hands out the first test
 * file, which is after this returns, so writing here is what the whole
 * suite reads (§6.6).
 */
export async function setup(project: TestProject): Promise<void> {
  // Migrations run from the compiled entrypoint, not through tsx, so the suite
  // exercises the same code path the container entrypoint uses (§5.2), and
  // test/integration/process-role.test.ts spawns `dist/main.js` for the same
  // reason — Nest cannot boot under tsx, which emits no `design:paramtypes`.
  // Checked before anything is started: a missing build is a one-line fix, not
  // worth three containers' startup first. Named here rather than skipped in
  // the test, because a test that quietly declines to run is worse than one
  // that fails.
  const migrate = fileURLToPath(new URL('../../dist/migrate.js', import.meta.url))
  const main = fileURLToPath(new URL('../../dist/main.js', import.meta.url))
  for (const entrypoint of [migrate, main]) {
    if (!existsSync(entrypoint)) {
      throw new Error(
        `[containers] ${entrypoint} is missing. The integration suite runs the compiled ` +
          'entrypoints; run `pnpm --filter api build` first — `pnpm check` does it for you.',
      )
    }
  }

  // Required with no default. Vitest gives a worker `process.env.NODE_ENV ||
  // 'test'`, but that assignment is the worker's own: this process, and the
  // migrator it spawns below, only have what the shell exported.
  process.env.NODE_ENV ??= 'test'

  postgres = await new PostgreSqlContainer('postgres:16')
    .withDatabase('dubaisupp')
    .withUsername('dubaisupp')
    .withPassword('dubaisupp')
    .start()

  redis = await new GenericContainer('redis:7.2-alpine').withExposedPorts(6379).start()

  rustfs = await new GenericContainer('rustfs/rustfs:1.0.0')
    .withExposedPorts(9000)
    .withEnvironment({ RUSTFS_ACCESS_KEY: 'rustfsadmin', RUSTFS_SECRET_KEY: 'rustfsadmin' })
    // The probe infra/compose.yaml uses. A listening port is not readiness
    // here: the gateway binds before it can answer an S3 request.
    .withWaitStrategy(Wait.forHttp('/health/ready', 9000))
    .start()

  const containers: ContainerEnv = {
    databaseUrl: postgres.getConnectionUri(),
    redisUrl: `redis://${redis.getHost()}:${String(redis.getMappedPort(6379))}/0`,
    s3Endpoint: `http://${rustfs.getHost()}:${String(rustfs.getMappedPort(9000))}`,
  }

  process.env.DATABASE_URL = containers.databaseUrl
  process.env.REDIS_URL = containers.redisUrl
  process.env.S3_ENDPOINT = containers.s3Endpoint
  process.env.S3_REGION = 'default'
  process.env.S3_BUCKET = 'dubaisupp'
  process.env.S3_ACCESS_KEY_ID = 'rustfsadmin'
  process.env.S3_SECRET_ACCESS_KEY = 'rustfsadmin'
  process.env.S3_FORCE_PATH_STYLE = 'true'

  // The second channel test/integration/harness.test.ts compares process.env
  // against: a setup that started the containers but failed to export one of
  // them is otherwise indistinguishable from the developer's own stack.
  project.provide('containers', containers)

  // No bucket is created here. The image ships no `mc mb` equivalent and
  // infra/compose.yaml's init sidecar has no counterpart in Testcontainers;
  // the storage port owns creating it (Task 14).

  // migrate.ts exits 1 and prints `[migrate] failed:` rather than throwing, so
  // a non-zero exit is the only signal and its stderr is the only diagnosis.
  // `timeout` is not belt and braces: vitest applies neither testTimeout nor
  // hookTimeout to a global setup, so a migrator that never exits — one that
  // took the advisory lock and kept its session — hangs the whole run with no
  // output at all rather than failing it. Measured, by doing exactly that.
  const { stderr } = await run(process.execPath, [migrate], {
    env: process.env,
    timeout: 60_000,
    killSignal: 'SIGKILL',
  }).catch((error: unknown) => {
    throw new Error(`[containers] migrating the container database failed:\n${String(error)}`)
  })
  const unexpected = withoutNodeWarnings(stderr)
  if (unexpected !== '') {
    throw new Error(`[containers] the migrator wrote to stderr:\n${stderr}`)
  }
}

/**
 * Node's own warnings, dropped. They arrive on stderr and are not the
 * migrator's doing: any dependency on the path this script takes — `pg`,
 * `drizzle-orm`, or something either of them loads — can start emitting an
 * ExperimentalWarning or a DeprecationWarning after a lockfile bump, which
 * would otherwise turn CI red with no change to the migrator at all. A real
 * failure is a non-zero exit, which rejects above, and prints
 * `[migrate] failed:`, which survives this filter — as does anything else
 * the migrator writes.
 */
function withoutNodeWarnings(stderr: string): string {
  return stderr
    .split('\n')
    .filter(
      (line) =>
        line.trim() !== '' &&
        // `(node:12345) ExperimentalWarning: …`, the trace-warnings hint that
        // may follow it, and the stack frames `--trace-warnings` adds.
        !/^\(node:\d+\) /u.test(line) &&
        !line.startsWith('(Use `node --trace-warnings') &&
        !/^\s+at /u.test(line),
    )
    .join('\n')
}

export async function teardown(): Promise<void> {
  // Each may be undefined: vitest still runs this when setup threw partway.
  await Promise.all([postgres?.stop(), redis?.stop(), rustfs?.stop()])
}
