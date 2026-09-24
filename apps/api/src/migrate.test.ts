import { execFile } from 'node:child_process'
import { createServer, type Server, type Socket } from 'node:net'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CONNECT_TIMEOUT_MS } from './infra/db/connect-timeout.js'

const run = promisify(execFile)
const apiRoot = fileURLToPath(new URL('../', import.meta.url))
// The runner `pnpm db:migrate` uses — tsx, because nothing in migrate.ts
// creates a Nest context (§4.2). Resolved through the package's exports map.
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli')

// A complete, schema-valid environment, so the developer's .env decides
// nothing: every store sits on a closed port.
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://dubaisupp:dubaisupp@127.0.0.1:1/dubaisupp',
  REDIS_URL: 'redis://127.0.0.1:1/0',
  S3_ENDPOINT: 'http://127.0.0.1:1',
  S3_BUCKET: 'dubaisupp',
  S3_ACCESS_KEY_ID: 'rustfsadmin',
  S3_SECRET_ACCESS_KEY: 'rustfsadmin',
}

describe('src/migrate.ts', () => {
  // §6.2: Liara keeps the previous release serving only because the
  // entrypoint's migration step exits non-zero. Port 1 is closed, so the
  // failure is the lock statement's connection — which also shows the
  // process environment won over any .env the file would have loaded.
  it('exits non-zero when the database is unreachable', async () => {
    const failure: unknown = await run(process.execPath, [tsxCli, 'src/migrate.ts'], {
      cwd: apiRoot,
      env,
    }).then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(failure).toMatchObject({
      code: 1,
      stderr: expect.stringContaining('[migrate] failed:') as string,
    })
    expect((failure as { stderr: string }).stderr).toContain('ECONNREFUSED')
  }, 30_000)

  /**
   * The failure a closed port cannot produce, and the one that hangs a deploy.
   *
   * ECONNREFUSED above is instant; this server completes the TCP handshake and
   * then never answers the startup packet, which is what a blackholed route or
   * a failover caught mid-flight looks like to `pg`. Without
   * `connectionTimeoutMillis` on the migrator's pool, `pool.connect()` has no
   * bound whatsoever and the process never exits — Liara waits on the release
   * command, not on a health check, so nothing times it out but a human.
   *
   * A local silent socket rather than an unroutable address on purpose: no
   * routing table decides the outcome, so this reproduces on any machine.
   */
  describe('against a server that accepts the socket and never speaks', () => {
    let server: Server
    let port: number
    const sockets: Socket[] = []

    beforeAll(async () => {
      server = createServer((socket) => {
        // Held, never written to, never ended.
        sockets.push(socket)
      })
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve)
      })
      const address = server.address()
      if (address === null || typeof address === 'string') {
        throw new Error('expected a TCP address from the silent server')
      }
      port = address.port
    })

    afterAll(async () => {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    })

    it('gives up and exits non-zero instead of hanging the deploy', async () => {
      const started = Date.now()
      const failure: unknown = await run(process.execPath, [tsxCli, 'src/migrate.ts'], {
        cwd: apiRoot,
        env: {
          ...env,
          DATABASE_URL: `postgres://dubaisupp:dubaisupp@127.0.0.1:${String(port)}/dubaisupp`,
        },
      }).then(
        () => undefined,
        (error: unknown) => error,
      )
      expect(failure).toMatchObject({
        code: 1,
        stderr: expect.stringContaining('[migrate] failed:') as string,
      })
      // pg's own words for the establish path, so this cannot pass on some
      // other failure that happened to arrive first.
      expect((failure as { stderr: string }).stderr).toContain(
        'Connection terminated due to connection timeout',
      )
      // And the bound is the pool's, not this test's timeout.
      expect(Date.now() - started).toBeLessThan(CONNECT_TIMEOUT_MS * 5)
    }, 60_000)
  })

  // The deploy log and the test above both grep for one line, so the
  // environment gate has to produce it too: parsed outside the try, an
  // invalid NODE_ENV still exits 1 but prints a bare ZodError instead.
  it('reports an invalid environment through the same failure line', async () => {
    const failure: unknown = await run(process.execPath, [tsxCli, 'src/migrate.ts'], {
      cwd: apiRoot,
      env: { ...env, NODE_ENV: 'nope' },
    }).then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(failure).toMatchObject({
      code: 1,
      stderr: expect.stringContaining('[migrate] failed:') as string,
    })
    // The offending key, so the operator is not left reading a stack trace.
    expect((failure as { stderr: string }).stderr).toContain('NODE_ENV')
  }, 30_000)
})

describe('src/infra/db/migration-lock.ts', () => {
  // Task 11 consumes MIGRATION_LOCK_KEY, so evaluating the module that owns
  // it must do nothing at all. While the constant lived in migrate.ts this
  // same run exited 1 with `[migrate] failed:` — naming the key would have
  // migrated the importer's database, and under vitest, silently.
  it('evaluates without opening a connection or printing anything', async () => {
    const { stdout, stderr } = await run(
      process.execPath,
      [tsxCli, 'src/infra/db/migration-lock.ts'],
      { cwd: apiRoot, env },
    )
    expect(stderr).toBe('')
    expect(stdout).toBe('')
  }, 30_000)
})
