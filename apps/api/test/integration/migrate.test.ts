import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import { ConfigModule } from '../../src/infra/config/index.js'
import { DbModule, DRIZZLE, type Db } from '../../src/infra/db/index.js'

// The committed artefact itself, replayed by the last test on the same marker
// the migrator splits it on.
const migrationSql = readFileSync(
  new URL('../../drizzle/0000_extensions.sql', import.meta.url),
  'utf8',
)

describe('0000_extensions', () => {
  let app: TestingModule
  let db: Db

  // The data layer only, and through the app's own wiring: ConfigModule is
  // what reads apps/api/.env, which vitest does not put into process.env.
  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [ConfigModule, DbModule] }).compile()
    await app.init()
    db = app.get<Db>(DRIZZLE)
  })

  afterAll(async () => {
    await app.close()
  })

  it('enables pg_trgm', async () => {
    const res = await db.execute(sql`select 1 from pg_extension where extname = 'pg_trgm'`)
    expect(res.rows).toHaveLength(1)
  })

  // Review Focus 4. Liara's Postgres may not be an ICU build (§3). This
  // makes that failure visible here rather than during the first deploy.
  it('creates the fa ICU collation', async () => {
    const res = await db.execute(sql`select collprovider from pg_collation where collname = 'fa'`)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({ collprovider: 'i' })
  })

  it('has an ICU-capable server at all, which is the guard first-deploy.md runs', async () => {
    const res = await db.execute(
      sql`select count(*)::int as n from pg_collation where collprovider = 'i'`,
    )
    // The one assertion here about the server rather than about the migration,
    // so it has to say which of the two is wrong — otherwise a build without
    // ICU reads as "expected 0 to be greater than 0".
    expect(
      (res.rows[0] as { n: number }).n,
      "PostgreSQL was built without ICU, so COLLATION fa (provider = icu, locale = 'fa') " +
        'cannot exist here. This is the fallback condition in first-deploy.md step 1: do not ' +
        'migrate, order by search_text instead, and record it as an ADR.',
    ).toBeGreaterThan(0)
  })

  it('sorts Persian text by the collation rather than by code point', async () => {
    // \u0648 ARABIC LETTER WAW and \u0647 ARABIC LETTER HEH, as escapes so the
    // line does not reorder under bidi. ICU's `fa` tailoring is the only
    // ordering reachable here that puts waw first: code point, the `und` root
    // and this database's own en_US default all put heh first. So this row
    // order can only come from locale = 'fa'.
    const res = await db.execute(
      sql`select x from (values ('\u0648'), ('\u0647')) as t(x) order by x collate "fa"`,
    )
    expect((res.rows[0] as { x: string }).x).toBe('\u0648')
  })

  // Guards against a hand-written migration that omits IF NOT EXISTS. The
  // migrator will not re-run 0000 by itself once the journal row is there, so
  // re-runnability is checked by replaying the committed file — which is what
  // a database left half-migrated by a failed deploy actually faces.
  it('is re-runnable: applying the committed SQL a second time does not fail', async () => {
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      await db.execute(sql.raw(statement))
    }
    const res = await db.execute(
      sql`select count(*)::int as n from pg_collation where collname = 'fa'`,
    )
    expect((res.rows[0] as { n: number }).n).toBe(1)
  })
})
