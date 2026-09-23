import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { AppModule } from '../../src/app.module.js'
import { AppConfig } from '../../src/infra/config/index.js'
import type * as ConfigBarrel from '../../src/infra/config/index.js'

const REQUIRED = [
  'DATABASE_URL=postgres://dubaisupp:dubaisupp@127.0.0.1:5432/dubaisupp',
  'REDIS_URL=redis://127.0.0.1:6379/0',
  'S3_ENDPOINT=http://127.0.0.1:9000',
  'S3_BUCKET=dubaisupp',
  'S3_ACCESS_KEY_ID=rustfsadmin',
  'S3_SECRET_ACCESS_KEY=rustfsadmin',
]

/**
 * `forRoot({ envFilePath: '.env' })` reads the file relative to
 * `process.cwd()` while `ConfigModule` is decorated — at import time, not at
 * `compile()` — so driving the env-file path means re-evaluating the module
 * with the cwd pointed at a scratch directory holding exactly `dotenv`, or
 * nothing at all.
 */
async function importConfigWith(dotenv: string | undefined): Promise<typeof ConfigBarrel> {
  const dir = mkdtempSync(join(tmpdir(), 'ds-config-'))
  if (dotenv !== undefined) writeFileSync(join(dir, '.env'), dotenv)
  const cwd = process.cwd()
  process.chdir(dir)
  try {
    vi.resetModules()
    return await import('../../src/infra/config/index.js')
  } finally {
    process.chdir(cwd)
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('boot-time env validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses to construct the module when DATABASE_URL is absent', async () => {
    vi.stubEnv('DATABASE_URL', undefined)
    const fresh = await importConfigWith(undefined)
    await expect(
      Test.createTestingModule({ imports: [fresh.ConfigModule] }).compile(),
    ).rejects.toThrow(/DATABASE_URL/u)
  })

  // The same gate, from the entrypoint's side: a .env carrying everything but
  // NODE_ENV, and none in the shell, is refused by name.
  it('refuses to construct the module when NODE_ENV is absent', async () => {
    vi.stubEnv('NODE_ENV', undefined)
    const fresh = await importConfigWith([...REQUIRED, ''].join('\n'))
    await expect(
      Test.createTestingModule({ imports: [fresh.ConfigModule] }).compile(),
    ).rejects.toThrow(/NODE_ENV/u)
  })

  // The factory must hand AppConfig the object `validate` produced, not a
  // second parse of process.env: @nestjs/config writes only strings, numbers
  // and booleans back to process.env, so an array such as CORS_ORIGINS
  // supplied through .env would otherwise collapse to [] without an error.
  it('builds AppConfig from the .env file, arrays included', async () => {
    vi.stubEnv('CORS_ORIGINS', undefined)
    const fresh = await importConfigWith(
      [...REQUIRED, 'CORS_ORIGINS=https://shop.example.ir,https://admin.example.ir', ''].join('\n'),
    )
    const moduleRef = await Test.createTestingModule({ imports: [fresh.ConfigModule] }).compile()
    try {
      expect(moduleRef.get(fresh.AppConfig).corsOrigins).toEqual([
        'https://shop.example.ir',
        'https://admin.example.ir',
      ])
    } finally {
      await moduleRef.close()
    }
  })

  it('exposes AppConfig through AppModule, built from the validated environment', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    try {
      expect(moduleRef.get(AppConfig).databaseUrl).toBe(process.env.DATABASE_URL)
    } finally {
      await moduleRef.close()
    }
  })
})
