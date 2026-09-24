import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

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
})
