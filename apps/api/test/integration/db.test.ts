import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import { AppConfig, ConfigModule, validatedEnv } from '../../src/infra/config/index.js'
import { DbModule, DRIZZLE, PG_POOL, type Db } from '../../src/infra/db/index.js'

/** Only the data layer, so the pool under test is this file's own. */
async function bootDb(poolMax?: number): Promise<TestingModule> {
  const builder = Test.createTestingModule({ imports: [ConfigModule, DbModule] })
  if (poolMax !== undefined) {
    builder
      .overrideProvider(AppConfig)
      .useValue(new AppConfig({ ...validatedEnv(), DATABASE_POOL_MAX: poolMax }))
  }
  const moduleRef = await builder.compile()
  return moduleRef.init()
}

describe('DbModule', () => {
  let db: Db
  let close: () => Promise<void>

  beforeAll(async () => {
    const app = await bootDb()
    db = app.get<Db>(DRIZZLE)
    close = () => app.close()
  })

  afterAll(async () => {
    await close()
  })

  it('executes a query through the pool', async () => {
    const rows = await db.execute(sql`select 1 as one`)
    expect(rows.rows[0]).toMatchObject({ one: 1 })
  })

  // pg's own default for `max` is 10 — the number .env.example carries too —
  // so asserting 10 on the canonical config passes against a pool built with
  // no `max` at all. A value pg would never pick, handed in through
  // AppConfig, is what shows the env reaches the pool.
  it('sizes the pool from DATABASE_POOL_MAX rather than pg defaults', async () => {
    const app = await bootDb(7)
    try {
      expect(app.get<Pool>(PG_POOL).options.max).toBe(7)
    } finally {
      await app.close()
    }
  })

  // src/openapi.ts boots the app in CI with no service containers (§5.5):
  // building the module must not open a connection. The first query does.
  it('opens no connection until the first query', async () => {
    const app = await bootDb()
    try {
      expect(app.get<Pool>(PG_POOL).totalCount).toBe(0)
    } finally {
      await app.close()
    }
  })

  it('closes the pool on shutdown, so a test run does not leak connections', async () => {
    await close()
    // Drizzle wraps the driver's error; pg's own message rides along as the
    // cause, and it is that message which says the pool ended rather than
    // the query failing for some other reason.
    const failure: unknown = await db.execute(sql`select 1`).then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).cause).toMatchObject({
      message: expect.stringContaining('after calling end') as string,
    })
    close = () => Promise.resolve()
  })
})
