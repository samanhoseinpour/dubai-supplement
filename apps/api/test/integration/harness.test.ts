import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import { AppConfig, ConfigModule } from '../../src/infra/config/index.js'
import { DbModule, DRIZZLE, type Db } from '../../src/infra/db/index.js'
import { flushRedis, truncateAll } from '../setup/truncate.js'

/**
 * The harness proving itself. A global setup that silently failed to write
 * DATABASE_URL would leave every other file in this directory running against
 * whatever `apps/api/.env` the developer happens to have — green, and for the
 * wrong reason.
 *
 * Three tests, pinning three different things, and only together. The first
 * pins propagation and nothing else: the provided context and process.env are
 * written from one object in one function, so their agreeing says the worker
 * inherited the main process's writes — a setup that computed a wrong URL
 * would write the same wrong URL to both and pass. The second says the URLs
 * are a container's rather than the compose stack's. The third says that is
 * what the application is actually built from, `.env` notwithstanding.
 */
const containers = inject('containers')

describe('the Testcontainers harness', () => {
  it('hands every worker the URLs the global setup created', () => {
    // Asserted first: without it, two undefineds would compare equal below.
    expect(containers.databaseUrl).toMatch(/^postgres(?:ql)?:\/\//u)
    expect(containers.redisUrl).toMatch(/^redis:\/\//u)
    expect(containers.s3Endpoint).toMatch(/^http:\/\//u)

    expect(process.env.DATABASE_URL).toBe(containers.databaseUrl)
    expect(process.env.REDIS_URL).toBe(containers.redisUrl)
    expect(process.env.S3_ENDPOINT).toBe(containers.s3Endpoint)
    expect(process.env.S3_REGION).toBe('default')
    expect(process.env.S3_BUCKET).toBe('dubaisupp')
    expect(process.env.S3_ACCESS_KEY_ID).toBe('rustfsadmin')
    expect(process.env.S3_SECRET_ACCESS_KEY).toBe('rustfsadmin')
    expect(process.env.S3_FORCE_PATH_STYLE).toBe('true')
    // Required with no default, and this suite must supply it rather than
    // inherit it: the global setup runs the compiled migrator as a child
    // process, which parses it (§4.2).
    expect(process.env.NODE_ENV).toBe('test')
  })

  // The compose stack publishes 5432, 6379 and 9000 on loopback and
  // .env.example names them; Testcontainers maps to an ephemeral port the
  // kernel picks. A harness that fell through to the developer's file — or to
  // `pnpm db:up` — lands on one of these three.
  it('points at the containers rather than at the compose stack', () => {
    expect(new URL(containers.databaseUrl).port).not.toBe('5432')
    expect(new URL(containers.redisUrl).port).not.toBe('6379')
    expect(new URL(containers.s3Endpoint).port).not.toBe('9000')
  })

  // The path every other file in this directory actually takes: ConfigModule
  // reads apps/api/.env, and only because a process value wins over the file
  // does the container URL reach AppConfig.
  it('builds AppConfig from the containers, not from apps/api/.env', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule] }).compile()
    try {
      const config = moduleRef.get(AppConfig)
      expect(config.databaseUrl).toBe(containers.databaseUrl)
      expect(config.redisUrl).toBe(containers.redisUrl)
      expect(config.s3.endpoint).toBe(containers.s3Endpoint)
      // Pinned by vitest.integration.config.ts's `env`, which the schema
      // default happens to match — so a .env naming other networks cannot
      // reach the adapter app.factory.test.ts asserts on.
      expect(config.trustProxy).toBe('loopback,uniquelocal')
    } finally {
      await moduleRef.close()
    }
  })
})

describe('the harness helpers', () => {
  let moduleRef: TestingModule
  let db: Db

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [ConfigModule, DbModule] }).compile()
    await moduleRef.init()
    db = moduleRef.get<Db>(DRIZZLE)
    await db.execute(sql`create table if not exists harness_probe (id serial primary key)`)
  })

  afterAll(async () => {
    await db.execute(sql`drop table if exists harness_probe`)
    await moduleRef.close()
  })

  // The container database is the one the global setup migrated, through the
  // compiled entrypoint: without that step the journal table does not exist.
  it('migrated the container database before any test ran', async () => {
    const res = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)
    expect((res.rows[0] as { n: number }).n).toBeGreaterThan(0)
  })

  // Isolation is truncation, not transaction rollback (§6.6), so the rows have
  // to be gone for every connection — and the sequence has to restart, or the
  // ids a test asserts on drift with the order the files ran in.
  it('truncateAll empties the named tables and restarts their identities', async () => {
    await db.execute(sql`insert into harness_probe default values`)
    await db.execute(sql`insert into harness_probe default values`)

    await truncateAll(db, ['harness_probe'])

    const empty = await db.execute(sql`select count(*)::int as n from harness_probe`)
    expect((empty.rows[0] as { n: number }).n).toBe(0)

    const again = await db.execute(sql`insert into harness_probe default values returning id`)
    expect((again.rows[0] as { id: number }).id).toBe(1)
  })

  // An empty list is TRUNCATE with no table — a syntax error — so the helper
  // has to return early rather than build it.
  it('truncateAll does nothing when handed no tables', async () => {
    await truncateAll(db, ['harness_probe'])
    await db.execute(sql`insert into harness_probe default values`)

    await truncateAll(db, [])

    const res = await db.execute(sql`select count(*)::int as n from harness_probe`)
    expect((res.rows[0] as { n: number }).n).toBe(1)
  })

  it('flushRedis empties the container Redis', async () => {
    const redis = new Redis(containers.redisUrl)
    try {
      await redis.set('harness:probe', '1')
      expect(await redis.exists('harness:probe')).toBe(1)
      await flushRedis()
      expect(await redis.exists('harness:probe')).toBe(0)
    } finally {
      redis.disconnect()
    }
  })
})
