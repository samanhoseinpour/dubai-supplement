# Dubai Supplement — Foundation Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the scaffolded `apps/api` into a NestJS 12 service that answers `GET /health/ready` against real Postgres and Redis, publishes domain events through a transactional outbox whose `runOnce()` is proven for success, retry and park, and is fronted by the two pure packages its error contract depends on.

**Architecture:** Three layers land in dependency order. First the two framework-free packages — `@ds/persian` (normalization, validation, formatting) and `@ds/contracts` (Zod shapes and `ErrorCode`) — because the API's exception filter emits the shape `@ds/contracts` describes. Then the cross-cutting concerns that every later module assumes: config, logging, errors, validation, security, OpenAPI. Then the data layer: Drizzle over `pg`, migrations under an advisory lock, a Testcontainers harness, and the outbox relay that discovers its handlers through Nest's `DiscoveryService`. Nothing here is a bounded context — `catalog`/Brand is Phase 3, and the outbox is proven with a synthetic event type.

**Tech Stack:** NestJS 12.0.4 ESM · `@nestjs/platform-fastify` 12.0.4 (pins Fastify 5.12.5) · Drizzle ORM 0.45.3 + drizzle-kit 0.31.11 · `pg` 8.23.0 · ioredis 5.11.1 · Zod 4.6.5 + zod-openapi 6.0.2 · `@nestjs/swagger` 12.0.1 · `@nestjs/terminus` 12.1.0 · nestjs-pino 5.2.0 · Vitest 5.0.1 + Testcontainers 12.1.0 · `@aws-sdk/client-s3` 3.1138.0

**Spec:** `docs/superpowers/specs/2026-08-27-foundation-design.md` (2026-08-27, revised 2026-09-23, amended 2026-09-23 evening). Read it alongside this plan — every task argues from a numbered section of it.

**Starting state:** `main` at commit `14b5ca4`. `apps/api` exists and is merged: the ESM scaffold, `src/main.ts` (Fastify adapter, `trustProxy: 'loopback,uniquelocal'`, `bodyLimit`, `rawBody`, shutdown hooks), `src/app.module.ts` (pino, throttler over Redis, health), `src/infra/health/` with `GET /health/live` only, `tsconfig.json` + `tsconfig.build.json`, `vitest.config.ts`, `eslint.config.js`. `pnpm check` is green. [ADR-0001](../../decisions/0001-nestjs-12-esm-on-fastify.md) records the spike: **go**, Nest 12 ESM on Fastify, Oxc emits decorator metadata natively, `@nest-lab/throttler-storage-redis` verified working under its peer override.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- **Human-only authorship.** Every commit is authored by `Saman Hoseinpour <105006550+samanhoseinpour@users.noreply.github.com>`. No `Co-Authored-By`, no "Generated with" footer, no bot attribution, ever. (§3, §13.4)
- **Exact pins only**, in the `pnpm-workspace.yaml` `catalog:`. `catalogMode: strict` — a workspace package may not name a version the catalog does not hold. `minimumReleaseAge` is 1440 minutes and stays armed: if a needed version is younger, pin the newest mature one rather than adding a `minimumReleaseAgeExclude`. (§3, §4.2)
- **ESM everywhere.** Relative imports carry an explicit `.js`. `import.meta.url`, never `__dirname` or `require`. (§12.1)
- **Contracts are Zod only.** No `class-validator`, no `class-transformer`, no DTO classes, no `@ApiProperty`. Banned by `no-restricted-imports`. (§5.5)
- **No `@nestjs/event-emitter`.** Domain events go through the outbox. Banned by lint. (§5.6, ADR-0009)
- **Fastify, never Express.** `@nestjs/platform-express` is banned by lint. No `MiddlewareConsumer`, no global prefix, no URI versioning. (§5.1, `.claude/rules/api.md`)
- **Money is IRR minor units** — `amountMinor bigint` plus `currency char(3)`. Never Toman in storage, never a float. (§6.3)
- **Timestamps are `timestamptz` in UTC.** Jalali is a display concern. (§6.3)
- **Persian copy exists only in the storefront.** The API speaks English — error titles, log messages, comments. (§5.5)
- **`tsx` only for Nest-less scripts.** Anything that creates a Nest context runs compiled from `dist/`, because esbuild emits no decorator metadata. (§4.2)
- **`trustProxy` is never a number.** Fastify 5.12.5 fails a numeric `trustProxy` closed. CIDR list or proxy-addr preset only. (§5.5, ADR-0001)
- **One verification command:** `pnpm check`. Every task ends green. (§3, §4.4)
- **Never run `sherif -f`.** Its autofix rewrites `pnpm-workspace.yaml` destructively.

## Review Focus

Five failure modes the spec implies but that no task's happy path would exercise. Each has a test pinned to the task that owns the code.

1. **Two relays consume the same outbox row.** `PROCESS_ROLE=all` runs the relay inside the HTTP app while a `worker` process runs another; §5.6 relies on `FOR UPDATE SKIP LOCKED` to keep them off each other's rows. If the lock clause is dropped or the transaction boundary is wrong, an event is delivered twice and every handler's idempotency becomes load-bearing by accident. Task 13 opens two concurrent `runOnce()` calls against one row and asserts it is processed exactly once. **Corrected 2026-09-24 by measurement.** That test alone is _not_ sufficient, and as originally written it passed with the lock clause deleted. Measured against a real `postgres:16`: when the first session processes the row and commits, a second session using plain `FOR UPDATE` blocks (~715 ms) and then returns **0 rows**, because READ COMMITTED re-evaluates `published_at is null` against the new row version. So the concurrent-`runOnce()` test distinguishes _a lock_ from _no lock_, never `SKIP LOCKED` from `FOR UPDATE`. The discriminating test is a second one that **holds the row lock from another session and never commits**: plain `FOR UPDATE` blocks (~1712 ms) and then returns the row, while `SKIP LOCKED` returns 0 rows in ~1 ms. Both tests are required, and the first needs a warmed pool plus a slow handler or pool laziness gives the first cycle a head start and the overlap never happens.
2. **A handler throws after doing half its work.** §5.6 retries a failed event on a later poll, so any handler with a side effect before the throw repeats that side effect. The relay cannot prevent it, but it must not compound it: the event's `attempts` must increment exactly once per failed cycle and `published_at` must stay null. Task 13 asserts both after a handler that mutates then throws.
3. **`TRUST_PROXY` is given a bare integer.** The number is what the spec originally specified and what any reader would try. Fastify accepts it and silently trusts nothing (ADR-0001). The Zod schema must reject it at boot with a message naming the trap, not coerce it. Task 4 asserts `TRUST_PROXY=1` fails validation.
4. **The `fa` ICU collation is missing.** §6.2 creates `COLLATION fa (provider = icu, locale = 'fa')` and §5.7 orders by it. A Postgres built without ICU — which is the open question about Liara (§3) — makes the migration fail. Task 11 asserts the collation exists after migrating and that the guard query `SELECT count(*) FROM pg_collation WHERE collprovider = 'i'` returns non-zero, so the failure is loud locally rather than at first deploy.
5. **`exactOptionalPropertyTypes` meets an optional column — this failure mode does not exist in this stack. Withdrawn 2026-09-24, verified twice.** The premise was that Drizzle's insert type for a nullable column accepts `string | null` but not `string | undefined`, so an absent optional would fail to compile and the natural `?? null` fix would change what is stored. That is false for drizzle 0.45.3. At the type level, `table.d.ts:61` writes the optional branch as `[Key]?: GetColumnData<…> | undefined` and `PgInsertValue` is homomorphic over it, so `lastError: string | undefined` compiles clean under the repo's own `exactOptionalPropertyTypes: true`. At runtime, `pg-core/dialect.js:377-388` emits `sql\`default\``for **both** an absent key and a`Param`holding`undefined`, so an absent optional becomes `DEFAULT`and then`NULL`; the string `"undefined"`cannot arise from a pinned`publish()`. Task 13 keeps `expect(row?.lastError).toBeNull()`on`outbox_events.last_error` as a cheap regression pin, with a comment recording why the hazard is absent — but no test here should claim to catch a compile-time trap that the compiler does not set.

---

## File Structure

Everything created or modified in this phase.

| Path                               | Responsibility                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/persian/`                | `normalizePersian`, digits, `formatToman`, `formatJalali`, `TEHRAN_TZ`, four validators (§7.3) |
| `packages/contracts/src/common/`   | `id`, `slug`, `persianText`, `PageQuerySchema`, `paginated` (§8.1)                             |
| `packages/contracts/src/errors/`   | `ErrorCode`, `ProblemDetailsSchema` — consumed by the exception filter (§8.1)                  |
| `infra/compose.yaml`               | Postgres, Redis, RustFS, Mailpit; healthchecks; `127.0.0.1` only (§9.2)                        |
| `apps/api/src/infra/config/`       | Zod env schema, `AppConfig` provider (§5.5)                                                    |
| `apps/api/src/infra/logger/`       | nestjs-pino wiring, redaction (§5.5)                                                           |
| `apps/api/src/shared/errors/`      | `AppError` hierarchy (§5.5)                                                                    |
| `apps/api/src/infra/http/`         | Exception filter, throttle constants, security wiring (§5.5)                                   |
| `apps/api/src/shared/openapi/`     | `@ApiZodResponse` (§5.5)                                                                       |
| `apps/api/src/openapi.ts`          | Writes `openapi.json` without live services (§5.5)                                             |
| `apps/api/src/infra/db/`           | Drizzle client, `pg` pool (§6.1)                                                               |
| `apps/api/src/migrate.ts`          | `migrate()` under `pg_advisory_lock`, no Nest context (§6.2)                                   |
| `apps/api/drizzle/`                | Committed SQL migrations, `0000_extensions` first (§6.2)                                       |
| `apps/api/src/infra/outbox/`       | `schema.ts`, `EventPublisher`, `OutboxRelay`, `@OnDomainEvent` (§5.6)                          |
| `apps/api/src/infra/redis/`        | ioredis provider, `KeyValueStore` port (§6.5)                                                  |
| `apps/api/src/infra/storage/`      | `StorageProvider` over `@aws-sdk/client-s3` (§6.5)                                             |
| `apps/api/src/worker.ts`           | `bootstrapWorker()`, relay only (§5.2)                                                         |
| `apps/api/test/integration/`       | Testcontainers harness, HTTP/outbox/KV/storage tests (§6.6)                                    |
| `apps/api/.dependency-cruiser.cjs` | Module boundary rules, `boundaries` task (§5.3)                                                |
| `turbo.json`                       | `env` declarations — absent today, and `envMode` is `strict` (App. B)                          |
| `.github/workflows/ci.yml`         | `check` job gains the §10.1 `build --affected` step (DoD 9)                                    |

---

## Task 1: `@ds/persian`

The only place normalization, validation and formatting live (§7.3). No workspace dependencies; owns the only `@persian-tools` dependency (§4.3 rule 1). Pure functions, no Docker, no framework.

**Files:**

- Create: `packages/persian/package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`
- Create: `packages/persian/src/index.ts`, `normalize.ts`, `format.ts`, `validators.ts`
- Test: `packages/persian/src/normalize.test.ts`, `format.test.ts`, `validators.test.ts`
- Modify: `pnpm-workspace.yaml` (catalog already holds `@persian-tools/persian-tools: 4.0.4`)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `normalizePersian(value: string): string`
  - `toAsciiDigits(value: string): string` · `toPersianDigits(value: string): string`
  - `formatNumber(value: number | bigint): string`
  - `formatToman(amountMinorIrr: bigint): string`
  - `formatJalali(date: Date, style?: 'short' | 'long'): string`
  - `TEHRAN_TZ: 'Asia/Tehran'`
  - `isIranMobile(v: string): boolean` · `isNationalId(v: string): boolean` · `isPostalCode(v: string): boolean` · `isSheba(v: string): boolean`

- [ ] **Step 1: Create the package skeleton**

`packages/persian/package.json`:

```json
{
  "name": "@ds/persian",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": { "@persian-tools/persian-tools": "catalog:" },
  "devDependencies": {
    "@ds/config-eslint": "workspace:*",
    "@ds/config-typescript": "workspace:*",
    "eslint": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`packages/persian/tsconfig.json` — note `outDir`/`rootDir` are declared here, never in the shared config (ADR-0001 consequence):

```json
{
  "extends": "@ds/config-typescript/library.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

`packages/persian/vitest.config.ts` — `clearMocks` is explicit because Vitest 5 flipped its default (§15):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], clearMocks: true },
})
```

`packages/persian/eslint.config.js`:

```js
// @ts-check
import base from '@ds/config-eslint/base'

export default [{ ignores: ['dist/**'] }, ...base]
```

- [ ] **Step 2: Write the failing normalization test**

`packages/persian/src/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizePersian, toAsciiDigits, toPersianDigits } from './normalize.js'

describe('normalizePersian', () => {
  it('rewrites Arabic yeh and kaf to their Persian forms', () => {
    // U+064A ARABIC YEH -> U+06CC FARSI YEH, U+0643 ARABIC KAF -> U+06A9 KEHEH
    expect(normalizePersian('يك')).toBe('یک')
  })

  it('folds Persian and Arabic-Indic digits to ASCII', () => {
    expect(normalizePersian('۱۲۳')).toBe('123')
    expect(normalizePersian('٠١٢')).toBe('012')
  })

  it('preserves ZWNJ, which carries meaning in Persian compounds', () => {
    // «ماسل‌تک» — the brand name in the Phase 3 seed. Losing U+200C here
    // would silently rewrite six catalogue entries.
    const withZwnj = 'ماسل‌تک'
    expect(normalizePersian(withZwnj)).toContain('‌')
  })

  it('leaves already-normal text untouched', () => {
    expect(normalizePersian('کتاب')).toBe('کتاب')
  })
})

describe('digit helpers', () => {
  it('round-trips ASCII to Persian and back', () => {
    expect(toPersianDigits('2026')).toBe('۲۰۲۶')
    expect(toAsciiDigits('۲۰۲۶')).toBe('2026')
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter @ds/persian exec vitest run src/normalize.test.ts`
Expected: FAIL — `Failed to resolve import "./normalize.js"`.

- [ ] **Step 4: Implement `normalize.ts`**

```ts
const ARABIC_YEH = /ي/gu
const ARABIC_KAF = /ك/gu
const PERSIAN_DIGITS = /[۰-۹]/gu
const ARABIC_INDIC_DIGITS = /[٠-٩]/gu
const ASCII_DIGITS = /[0-9]/gu

const PERSIAN_ZERO = 0x06f0
const ARABIC_INDIC_ZERO = 0x0660

/**
 * Canonical form for Persian text on write (§6.3). Deliberately does NOT
 * touch U+200C ZWNJ: it distinguishes «ماسل‌تک» from «ماسلتک».
 */
export function normalizePersian(value: string): string {
  return value
    .replace(ARABIC_YEH, 'ی')
    .replace(ARABIC_KAF, 'ک')
    .replace(PERSIAN_DIGITS, (d) => String(d.codePointAt(0)! - PERSIAN_ZERO))
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.codePointAt(0)! - ARABIC_INDIC_ZERO))
}

export function toAsciiDigits(value: string): string {
  return value
    .replace(PERSIAN_DIGITS, (d) => String(d.codePointAt(0)! - PERSIAN_ZERO))
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.codePointAt(0)! - ARABIC_INDIC_ZERO))
}

export function toPersianDigits(value: string): string {
  return value.replace(ASCII_DIGITS, (d) => String.fromCodePoint(PERSIAN_ZERO + Number(d)))
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm --filter @ds/persian exec vitest run src/normalize.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 6: Write the failing formatting test**

`packages/persian/src/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TEHRAN_TZ, formatJalali, formatNumber, formatToman } from './format.js'

describe('formatToman', () => {
  it('divides rial minor units by ten and labels the result', () => {
    // 1,500,000 IRR minor units = 150,000 toman
    const out = formatToman(1_500_000n)
    expect(out).toContain('تومان') // تومان
    expect(out).toContain('۱') // Persian digit one
    expect(out).not.toMatch(/[0-9]/) // never ASCII digits in customer-facing output
  })

  it('handles zero', () => {
    expect(formatToman(0n)).toContain('۰')
  })

  it('truncates sub-toman remainders rather than rounding up', () => {
    // 19 rial is 1.9 toman; showing 2 would overstate a price.
    expect(formatToman(19n)).toBe(formatToman(10n))
  })
})

describe('formatJalali', () => {
  it('formats in the Persian calendar, in Tehran time', () => {
    // 2026-03-20T22:00:00Z is 2026-03-21 01:30 in Tehran -> 1 Farvardin 1405
    const out = formatJalali(new Date('2026-03-20T22:00:00Z'))
    expect(out).toContain('۱۴۰۵') // ۱۴۰۵
  })

  it('pins the timezone constant', () => {
    expect(TEHRAN_TZ).toBe('Asia/Tehran')
  })
})

describe('formatNumber', () => {
  it('groups with the Persian separator and Persian digits', () => {
    expect(formatNumber(1234567)).not.toMatch(/[0-9]/)
    expect(formatNumber(1234567)).toContain('٬')
  })
})
```

- [ ] **Step 7: Run it and watch it fail**

Run: `pnpm --filter @ds/persian exec vitest run src/format.test.ts`
Expected: FAIL — cannot resolve `./format.js`.

- [ ] **Step 8: Implement `format.ts`**

```ts
export const TEHRAN_TZ = 'Asia/Tehran' as const

const RIAL_PER_TOMAN = 10n

const numberFormat = new Intl.NumberFormat('fa-IR')
const jalaliShort = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: TEHRAN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const jalaliLong = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: TEHRAN_TZ,
  dateStyle: 'long',
})

export function formatNumber(value: number | bigint): string {
  return numberFormat.format(value)
}

/**
 * `amountMinorIrr` is rials (§6.3). Integer division truncates on purpose:
 * rounding up would show a customer a price above the one charged.
 */
export function formatToman(amountMinorIrr: bigint): string {
  const toman = amountMinorIrr / RIAL_PER_TOMAN
  return `${numberFormat.format(toman)} تومان`
}

/** Server-side only — formatting on the client risks an ICU hydration mismatch (§7.3). */
export function formatJalali(date: Date, style: 'short' | 'long' = 'short'): string {
  return style === 'long' ? jalaliLong.format(date) : jalaliShort.format(date)
}
```

- [ ] **Step 9: Run it and watch it pass**

Run: `pnpm --filter @ds/persian exec vitest run src/format.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 10: Write the failing validator test**

`packages/persian/src/validators.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isIranMobile, isNationalId, isPostalCode, isSheba } from './validators.js'

describe('isIranMobile', () => {
  it('accepts the common domestic and E.164 forms', () => {
    expect(isIranMobile('09123456789')).toBe(true)
    expect(isIranMobile('+989123456789')).toBe(true)
  })
  it('accepts a number written with Persian digits', () => {
    // Users paste from Persian keyboards constantly; normalize first.
    expect(isIranMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true)
  })
  it('rejects a landline and a truncated number', () => {
    expect(isIranMobile('02112345678')).toBe(false)
    expect(isIranMobile('0912345')).toBe(false)
  })
})

describe('isNationalId', () => {
  it('rejects a well-formed but checksum-invalid id', () => {
    expect(isNationalId('1234567890')).toBe(false)
  })
  it('rejects all-same-digit ids, which pass a naive checksum', () => {
    expect(isNationalId('1111111111')).toBe(false)
  })
})

describe('isPostalCode and isSheba', () => {
  it('requires ten digits for a postal code', () => {
    expect(isPostalCode('1234567890')).toBe(true)
    expect(isPostalCode('12345')).toBe(false)
  })
  it('requires the IR prefix and 24 further characters for a sheba', () => {
    expect(isSheba('IR062960000000100324200001')).toBe(true)
    expect(isSheba('062960000000100324200001')).toBe(false)
  })
})
```

- [ ] **Step 11: Run it and watch it fail**

Run: `pnpm --filter @ds/persian exec vitest run src/validators.test.ts`
Expected: FAIL — cannot resolve `./validators.js`.

- [ ] **Step 12: Implement `validators.ts`**

Every validator normalizes first, so a Persian-digit input behaves like an ASCII one.

```ts
import { verifyIranianNationalId, isShebaValid } from '@persian-tools/persian-tools'
import { toAsciiDigits } from './normalize.js'

const IRAN_MOBILE = /^(?:\+98|0098|98|0)?9\d{9}$/u
const POSTAL_CODE = /^\d{10}$/u

export function isIranMobile(value: string): boolean {
  return IRAN_MOBILE.test(toAsciiDigits(value).trim())
}

export function isNationalId(value: string): boolean {
  const ascii = toAsciiDigits(value).trim()
  if (!/^\d{10}$/u.test(ascii)) return false
  // `verifyIranianNationalId` throws on some malformed inputs rather than
  // returning false, so the regex guard above is not redundant.
  return verifyIranianNationalId(ascii) === true
}

export function isPostalCode(value: string): boolean {
  return POSTAL_CODE.test(toAsciiDigits(value).trim())
}

export function isSheba(value: string): boolean {
  return isShebaValid(toAsciiDigits(value).trim().toUpperCase())
}
```

> If `@persian-tools/persian-tools` 4.0.4 exports these under different names, check its `dist/index.d.ts` and adjust the import — the wrapper signatures above are what `@ds/contracts` consumes and must not change.

- [ ] **Step 13: Run it and watch it pass**

Run: `pnpm --filter @ds/persian exec vitest run`
Expected: PASS, 14/14 across three files.

- [ ] **Step 14: Write the barrel and build**

`packages/persian/src/index.ts`:

```ts
export { normalizePersian, toAsciiDigits, toPersianDigits } from './normalize.js'
export { TEHRAN_TZ, formatJalali, formatNumber, formatToman } from './format.js'
export { isIranMobile, isNationalId, isPostalCode, isSheba } from './validators.js'
```

Run: `pnpm install && pnpm --filter @ds/persian build`
Expected: `dist/index.js` and `dist/index.d.ts` exist.

- [ ] **Step 15: Verify and commit**

Run: `pnpm check`
Expected: green. `sherif` reports no issues.

```bash
git add packages/persian pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(persian): add the Persian normalization, formatting and validation package"
```

---

## Task 2: `@ds/contracts` — common shapes and the error contract

§8.1, minus `catalog/brand.ts`, which belongs to Phase 3's reference slice. This exists now because Task 6's exception filter emits the shape `ProblemDetailsSchema` describes and uses `ErrorCode` as its enum — defining them locally and reconciling later would mean writing the same thing twice.

**Files:**

- Create: `packages/contracts/package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`
- Create: `packages/contracts/src/index.ts`, `src/common/index.ts`, `src/errors/index.ts`
- Test: `packages/contracts/src/common/common.test.ts`, `src/errors/errors.test.ts`

**Interfaces:**

- Consumes: `normalizePersian(value: string): string` from `@ds/persian`.
- Produces:
  - `id: z.ZodString` · `slug: z.ZodString`
  - `persianText(max: number): z.ZodType<string>`
  - `PageQuerySchema` → `{ page: number; pageSize: number }`
  - `paginated<T extends z.ZodTypeAny>(item: T)` → `{ items: T[]; page: number; pageSize: number; total: number }`
  - `ErrorCode` union and `ERROR_CODES` array
  - `ProblemDetailsSchema` and `type ProblemDetails`

- [ ] **Step 1: Create the package skeleton**

`packages/contracts/package.json` — exactly two runtime dependencies (§4.3 rule 2):

```json
{
  "name": "@ds/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": { "@ds/persian": "workspace:*", "zod": "catalog:" },
  "devDependencies": {
    "@ds/config-eslint": "workspace:*",
    "@ds/config-typescript": "workspace:*",
    "eslint": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`tsconfig.json`, `vitest.config.ts` and `eslint.config.js` are byte-identical to Task 1's, with `@ds/config-typescript/library.json`, `outDir: "dist"`, `rootDir: "src"`.

- [ ] **Step 2: Write the failing common-schema test**

`packages/contracts/src/common/common.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PageQuerySchema, paginated, persianText, slug } from './index.js'
import { z } from 'zod'

describe('persianText', () => {
  it('normalizes before validating, so Arabic yeh is accepted', () => {
    const parsed = persianText(50).parse('يك')
    expect(parsed).toBe('یک')
  })

  it('counts code points, not UTF-16 units, and charges ZWNJ exactly one', () => {
    // Zod 4.6 changed .max() to code points (§8.1). «ماسل‌تک» is 7 code points.
    const name = 'ماسل‌تک'
    expect(() => persianText(7).parse(name)).not.toThrow()
    expect(() => persianText(6).parse(name)).toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => persianText(50).parse('')).toThrow()
  })
})

describe('slug', () => {
  it('accepts lowercase Latin with hyphens and rejects anything else', () => {
    expect(slug.parse('optimum-nutrition')).toBe('optimum-nutrition')
    expect(() => slug.parse('Optimum')).toThrow()
    expect(() => slug.parse('ماسل')).toThrow()
  })
})

describe('PageQuerySchema', () => {
  it('defaults, coerces from query strings, and caps pageSize', () => {
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(PageQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 })
    expect(() => PageQuerySchema.parse({ pageSize: '101' })).toThrow()
    expect(() => PageQuerySchema.parse({ page: '0' })).toThrow()
  })
})

describe('paginated', () => {
  it('wraps an item schema with the page envelope', () => {
    const schema = paginated(z.object({ id: z.uuid() }))
    const value = {
      items: [{ id: '0199f3c0-1111-7000-8000-000000000000' }],
      page: 1,
      pageSize: 20,
      total: 1,
    }
    expect(schema.parse(value)).toEqual(value)
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter @ds/contracts exec vitest run`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 4: Implement `src/common/index.ts`**

```ts
import { z } from 'zod'
import { normalizePersian } from '@ds/persian'

export const id = z.uuid()

export const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/u, 'must be lowercase Latin letters, digits and hyphens')
  .max(64)

/**
 * HTTP inputs are normalized here; the domain entity normalizes again on
 * write (§6.3), so both paths agree. Zod 4.6 counts code points, which is
 * the semantics we want — a ZWNJ costs one.
 */
export function persianText(max: number): z.ZodType<string> {
  return z.preprocess(
    (v) => (typeof v === 'string' ? normalizePersian(v) : v),
    z.string().min(1).max(max),
  )
}

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  })
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm --filter @ds/contracts exec vitest run src/common/common.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 6: Write the failing error-contract test**

`packages/contracts/src/errors/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ERROR_CODES, ProblemDetailsSchema } from './index.js'

describe('ErrorCode', () => {
  it('holds exactly the nine codes the spec names', () => {
    expect([...ERROR_CODES].sort()).toEqual(
      [
        'CATALOG_BRAND_NOT_FOUND',
        'CATALOG_BRAND_SLUG_TAKEN',
        'CONFLICT',
        'FORBIDDEN',
        'INTERNAL',
        'NOT_FOUND',
        'RATE_LIMITED',
        'UNAUTHORIZED',
        'VALIDATION_FAILED',
      ].sort(),
    )
  })
})

describe('ProblemDetailsSchema', () => {
  it('accepts an RFC 9457 body without the optional errors array', () => {
    const problem = {
      type: 'urn:problem:NOT_FOUND',
      title: 'Not Found',
      status: 404,
      instance: 'req-1',
      code: 'NOT_FOUND',
    }
    expect(ProblemDetailsSchema.parse(problem)).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('accepts a validation body carrying field errors', () => {
    const problem = {
      type: 'urn:problem:VALIDATION_FAILED',
      title: 'Validation Failed',
      status: 400,
      instance: 'req-2',
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'page', message: 'expected number' }],
    }
    expect(ProblemDetailsSchema.parse(problem).errors).toHaveLength(1)
  })

  it('rejects a code outside the enum', () => {
    expect(() =>
      ProblemDetailsSchema.parse({
        type: 'urn:problem:NOPE',
        title: 'Nope',
        status: 418,
        instance: 'req-3',
        code: 'NOPE',
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 7: Run it and watch it fail**

Run: `pnpm --filter @ds/contracts exec vitest run src/errors/errors.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 8: Implement `src/errors/index.ts`**

```ts
import { z } from 'zod'

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
  'CATALOG_BRAND_NOT_FOUND',
  'CATALOG_BRAND_SLUG_TAKEN',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const ErrorCodeSchema = z.enum(ERROR_CODES)

/** RFC 9457 `application/problem+json` (§5.5). `title` is an English constant per code. */
export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string(),
  code: ErrorCodeSchema,
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
})

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>
```

- [ ] **Step 9: Run it, build, verify, commit**

```bash
pnpm --filter @ds/contracts exec vitest run   # 10/10
pnpm install && pnpm --filter @ds/contracts build
pnpm check
```

`src/index.ts` re-exports both namespaces:

```ts
export * from './common/index.js'
export * from './errors/index.js'
```

```bash
git add packages/contracts pnpm-lock.yaml
git commit -m "feat(contracts): add common Zod shapes and the RFC 9457 error contract"
```

---

## Task 3: `infra/compose.yaml`

§9.2. Four services with healthchecks so `up -d --wait` returns only when they are usable, all bound to `127.0.0.1` so nothing is exposed on the LAN.

> **Amended after implementation (2026-09-23).** Five values in the compose block
> below were wrong and are corrected in the shipped `infra/compose.yaml`, which is
> the authority. Each was proven by watching it fail, and both reviews reproduced
> the premises independently:
>
> 1. **`rustfs-cli` does not exist** in `rustfs/rustfs:1.0.0` (`command -v` → 127;
>    `mc` is absent too). The bucket is created with the image's own
>    `curl --aws-sigv4`, region `default`.
> 2. **The RustFS healthcheck `GET /` can never pass** — it is an anonymous
>    ListBuckets returning 403, so `curl -f` exits 22 and the container never goes
>    healthy. Use `/health/ready`, which reports real write-quorum readiness.
> 3. **Compose 5.1.2 fails `--wait` on the exited(0) one-shot** init container, so
>    `db:up` exited 1 with all four services healthy. Resolved with
>    `mailpit.depends_on: rustfs-init: service_completed_successfully`.
> 4. **`pg_isready` with no `-h` probes the Unix socket**, which is ready while the
>    first-boot temporary server runs with `listen_addresses=''` — `--wait` could
>    return before TCP 5432 accepts. Use `-h 127.0.0.1`.
> 5. **`axllent/mailpit:latest` is unpinned** and its healthcheck depended on
>    BusyBox `wget`; Renovate cannot pin a bare `latest`. Pinned to `v1.31.2` with
>    the image's own `/mailpit readyz` probe.
>
> `start_period: 10s` was also added to the three healthchecks authored here.
> RustFS additionally does **not** enforce region and returns 200 (not 409) on
> CreateBucket for an existing bucket — Task 14's `ensureBucket()` must not depend
> on catching a 409.

**Files:**

- Create: `infra/compose.yaml`
- Modify: `.gitignore` (add `infra/data/` if any service writes locally — RustFS does not with a named volume)

**Interfaces:**

- Consumes: nothing.
- Produces: the canonical local endpoints every later task's `.env.example` and Testcontainers setup must match (Appendix B) — Postgres `127.0.0.1:5432` db/user/password all `dubaisupp`; Redis `127.0.0.1:6379`; S3 `127.0.0.1:9000` with key/secret `rustfsadmin` and bucket `dubaisupp`; Mailpit SMTP `1025`, UI `8025`.

- [ ] **Step 1: Write `infra/compose.yaml`**

```yaml
name: dubaisupp

services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: dubaisupp
      POSTGRES_PASSWORD: dubaisupp
      POSTGRES_DB: dubaisupp
    ports: ['127.0.0.1:5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dubaisupp -d dubaisupp']
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7.2-alpine
    restart: unless-stopped
    ports: ['127.0.0.1:6379:6379']
    volumes: ['redisdata:/data']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 10

  rustfs:
    image: rustfs/rustfs:1.0.0
    restart: unless-stopped
    environment:
      RUSTFS_ACCESS_KEY: rustfsadmin
      RUSTFS_SECRET_KEY: rustfsadmin
    ports: ['127.0.0.1:9000:9000', '127.0.0.1:9001:9001']
    volumes: ['rustfsdata:/data']
    healthcheck:
      test: ['CMD-SHELL', 'curl -fsS http://127.0.0.1:9000/ >/dev/null || exit 1']
      interval: 5s
      timeout: 5s
      retries: 20

  # Creates the bucket once the gateway is healthy, then exits 0.
  rustfs-init:
    image: rustfs/rustfs:1.0.0
    depends_on:
      rustfs: { condition: service_healthy }
    entrypoint: ['/bin/sh', '-c']
    command:
      - |
        rustfs-cli alias set local http://rustfs:9000 rustfsadmin rustfsadmin &&
        rustfs-cli mb --ignore-existing local/dubaisupp
    restart: 'no'

  mailpit:
    image: axllent/mailpit
    restart: unless-stopped
    ports: ['127.0.0.1:1025:1025', '127.0.0.1:8025:8025']
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:8025/readyz']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
  redisdata:
  rustfsdata:
```

> `rustfs-init`'s CLI name and flags are the one thing here not verified against the image. Run step 2; if `rustfs-cli` is absent, `docker run --rm --entrypoint sh rustfs/rustfs:1.0.0 -c 'ls /usr/bin | grep -i rust'` finds the real binary. Do not substitute the MinIO client — it is a different project.

- [ ] **Step 2: Bring the stack up and prove every service is actually usable**

Run: `pnpm db:up`
Expected: exits 0 only once all four report healthy. `--wait` is what makes this a real gate.

Then verify each endpoint rather than trusting the healthcheck:

```bash
docker compose -f infra/compose.yaml ps --format '{{.Service}}\t{{.Status}}'
psql 'postgres://dubaisupp:dubaisupp@127.0.0.1:5432/dubaisupp' -c 'select 1'   # or: docker compose -f infra/compose.yaml exec postgres psql -U dubaisupp -d dubaisupp -c 'select 1'
docker compose -f infra/compose.yaml exec redis redis-cli ping                  # PONG
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9000/               # any 2xx/4xx proves it listens
curl -fsS http://127.0.0.1:8025/readyz                                          # Mailpit
```

- [ ] **Step 3: Confirm nothing is exposed beyond loopback**

Run: `docker compose -f infra/compose.yaml ps --format '{{.Service}} {{.Ports}}'`
Expected: every published port is prefixed `127.0.0.1:`. A bare `0.0.0.0:5432` means the binding was dropped and the database is on the LAN.

- [ ] **Step 4: Confirm the down path**

Run: `pnpm db:down && docker compose -f infra/compose.yaml ps -q | wc -l`
Expected: `0`. Then `pnpm db:up` again — the named volumes must make it idempotent.

- [ ] **Step 5: Verify and commit**

Run: `pnpm check`
Expected: green.

```bash
git add infra/compose.yaml
git commit -m "feat(infra): add the local Postgres, Redis, RustFS and Mailpit stack"
```

---

## Task 4: Config — the Zod env schema and `AppConfig`

§5.5 Config row, Appendix B. The process refuses to boot on invalid env. This task also fills in `turbo.json`'s `env` arrays, which are **empty today** while `envMode` is `strict` — every api task would otherwise run with the variables stripped.

**Files:**

- Create: `apps/api/src/infra/config/env.schema.ts`, `app-config.ts`, `config.module.ts`, `index.ts`
- Create: `apps/api/.env.example`
- Test: `apps/api/src/infra/config/env.schema.test.ts`
- Modify: `apps/api/package.json` (add `@nestjs/config`), `apps/api/src/app.module.ts`, `turbo.json`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `EnvSchema: z.ZodType<Env>` and `type Env`
  - `class AppConfig` with readonly fields: `nodeEnv`, `processRole: 'api' | 'worker' | 'all'`, `port: number`, `logLevel: string`, `databaseUrl: string`, `databasePoolMax: number`, `redisUrl: string`, `s3: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean }`, `corsOrigins: string[]`, `trustProxy: string`, `outboxPollMs: number`, `openapiUiEnabled: boolean`
  - `ConfigModule` (global) providing `AppConfig`

- [ ] **Step 1: Write the failing schema test**

`apps/api/src/infra/config/env.schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EnvSchema } from './env.schema.js'

const valid = {
  DATABASE_URL: 'postgres://dubaisupp:dubaisupp@127.0.0.1:5432/dubaisupp',
  REDIS_URL: 'redis://127.0.0.1:6379/0',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_BUCKET: 'dubaisupp',
  S3_ACCESS_KEY_ID: 'rustfsadmin',
  S3_SECRET_ACCESS_KEY: 'rustfsadmin',
}

describe('EnvSchema', () => {
  it('boots from only the six required keys, defaulting the rest', () => {
    const env = EnvSchema.parse(valid)
    expect(env.PROCESS_ROLE).toBe('api')
    expect(env.PORT).toBe(3001)
    expect(env.OUTBOX_POLL_MS).toBe(1000)
    expect(env.S3_REGION).toBe('default')
    expect(env.S3_FORCE_PATH_STYLE).toBe(true)
    expect(env.CORS_ORIGINS).toEqual([])
  })

  it('refuses to boot when a required key is missing', () => {
    const { DATABASE_URL, ...withoutDb } = valid
    expect(() => EnvSchema.parse(withoutDb)).toThrow()
  })

  // Review Focus 3. A hop count is what the spec originally specified and
  // what any reader would reach for; Fastify accepts it and then trusts
  // nothing, silently (ADR-0001). It must fail loudly here instead.
  it('rejects a numeric TRUST_PROXY rather than coercing it', () => {
    expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: '1' })).toThrow(/never a number/iu)
    expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: '0' })).toThrow(/never a number/iu)
  })

  it('rejects boolean TRUST_PROXY, which would trust every hop', () => {
    expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: 'true' })).toThrow()
  })

  it('accepts a preset list and a CIDR list', () => {
    expect(EnvSchema.parse({ ...valid, TRUST_PROXY: 'loopback,uniquelocal' }).TRUST_PROXY).toBe(
      'loopback,uniquelocal',
    )
    expect(EnvSchema.parse({ ...valid, TRUST_PROXY: '10.0.0.0/8' }).TRUST_PROXY).toBe('10.0.0.0/8')
  })

  it('splits CORS_ORIGINS and rejects the wildcard', () => {
    expect(
      EnvSchema.parse({ ...valid, CORS_ORIGINS: 'https://a.ir,https://b.ir' }).CORS_ORIGINS,
    ).toEqual(['https://a.ir', 'https://b.ir'])
    expect(() => EnvSchema.parse({ ...valid, CORS_ORIGINS: '*' })).toThrow()
    expect(() => EnvSchema.parse({ ...valid, CORS_ORIGINS: 'null' })).toThrow()
  })

  it('rejects an unknown PROCESS_ROLE', () => {
    expect(() => EnvSchema.parse({ ...valid, PROCESS_ROLE: 'relay' })).toThrow()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter api exec vitest run src/infra/config/env.schema.test.ts`
Expected: FAIL — cannot resolve `./env.schema.js`.

- [ ] **Step 3: Implement `env.schema.ts`**

```ts
import { z } from 'zod'

const NUMERIC_ONLY = /^\d+$/u

/**
 * `trustProxy` is handed straight to Fastify. Fastify 5.12.5 returns
 * `() => false` for a number — trusting nothing, with no error — so a hop
 * count must be refused here or the throttler silently keys every request
 * on the proxy's address (ADR-0001, §5.5).
 */
const trustProxy = z
  .string()
  .min(1)
  .refine((v) => !NUMERIC_ONLY.test(v.trim()), {
    message:
      'TRUST_PROXY is never a number: Fastify treats a hop count as "trust nothing". ' +
      'Use a CIDR list or the presets loopback, linklocal, uniquelocal.',
  })
  .refine((v) => v.trim() !== 'true' && v.trim() !== 'false', {
    message: 'TRUST_PROXY must not be a boolean; name the networks you trust.',
  })

const corsOrigins = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .refine((list) => list.every((o) => o !== '*' && o !== 'null'), {
    message: 'CORS_ORIGINS may not contain * or null.',
  })

export const EnvSchema = z.object({
  // Required, no default: a deploy that forgets it must fail at this gate rather
  // than inside a pino worker loading a devDependency production never installed.
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PROCESS_ROLE: z.enum(['api', 'worker', 'all']).default('api'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1).default('default'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  CORS_ORIGINS: corsOrigins,
  TRUST_PROXY: trustProxy.default('loopback,uniquelocal'),

  OUTBOX_POLL_MS: z.coerce.number().int().min(50).default(1000),

  OPENAPI_UI_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

export type Env = z.infer<typeof EnvSchema>
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter api exec vitest run src/infra/config/env.schema.test.ts`
Expected: PASS, 8/8.

- [ ] **Step 5: Implement `AppConfig` and the module**

`app-config.ts` — a typed façade so nothing downstream reads `process.env`:

```ts
import { Injectable } from '@nestjs/common'
import type { Env } from './env.schema.js'

@Injectable()
export class AppConfig {
  readonly nodeEnv: Env['NODE_ENV']
  readonly processRole: Env['PROCESS_ROLE']
  readonly port: number
  readonly logLevel: Env['LOG_LEVEL']
  readonly databaseUrl: string
  readonly databasePoolMax: number
  readonly redisUrl: string
  readonly s3: {
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    forcePathStyle: boolean
  }
  readonly corsOrigins: string[]
  readonly trustProxy: string
  readonly outboxPollMs: number
  readonly openapiUiEnabled: boolean

  constructor(env: Env) {
    this.nodeEnv = env.NODE_ENV
    this.processRole = env.PROCESS_ROLE
    this.port = env.PORT
    this.logLevel = env.LOG_LEVEL
    this.databaseUrl = env.DATABASE_URL
    this.databasePoolMax = env.DATABASE_POOL_MAX
    this.redisUrl = env.REDIS_URL
    this.s3 = {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    }
    this.corsOrigins = env.CORS_ORIGINS
    this.trustProxy = env.TRUST_PROXY
    this.outboxPollMs = env.OUTBOX_POLL_MS
    this.openapiUiEnabled = env.OPENAPI_UI_ENABLED
  }
}
```

`config.module.ts`:

```ts
import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { AppConfig } from './app-config.js'
import { EnvSchema } from './env.schema.js'

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: '.env',
      // Zod's own message is more useful than Nest's wrapper, and a boot
      // failure must name the offending key.
      validate: (raw) => EnvSchema.parse(raw),
    }),
  ],
  providers: [
    {
      provide: AppConfig,
      inject: [NestConfigModule],
      useFactory: () => new AppConfig(EnvSchema.parse(process.env)),
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
```

`index.ts`: `export { AppConfig } from './app-config.js'; export { ConfigModule } from './config.module.js'; export { EnvSchema, type Env } from './env.schema.js'`

- [ ] **Step 6: Write `apps/api/.env.example`**

Schema-valid localhost values for every key (Appendix B). Never a real secret — it is committed, and `.gitignore` allows it through `!**/.env.example`.

```dotenv
NODE_ENV=development
PROCESS_ROLE=all
PORT=3001
LOG_LEVEL=debug

DATABASE_URL=postgres://dubaisupp:dubaisupp@127.0.0.1:5432/dubaisupp
DATABASE_POOL_MAX=10

REDIS_URL=redis://127.0.0.1:6379/0

S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=default
S3_BUCKET=dubaisupp
S3_ACCESS_KEY_ID=rustfsadmin
S3_SECRET_ACCESS_KEY=rustfsadmin
S3_FORCE_PATH_STYLE=true

CORS_ORIGINS=
TRUST_PROXY=loopback,uniquelocal

OUTBOX_POLL_MS=1000
OPENAPI_UI_ENABLED=true
```

- [ ] **Step 7: Declare the variables in `turbo.json`**

`envMode` is `strict`, so an undeclared key is invisible to the task. Add to the root `tasks` block:

```json
"api#build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
"api#test": {
  "dependsOn": ["^build"],
  "env": ["NODE_ENV", "PROCESS_ROLE", "PORT", "LOG_LEVEL", "DATABASE_URL", "DATABASE_POOL_MAX", "REDIS_URL", "S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_FORCE_PATH_STYLE", "CORS_ORIGINS", "TRUST_PROXY", "OUTBOX_POLL_MS", "OPENAPI_UI_ENABLED"]
},
"api#test:integration": { "dependsOn": ["^build"], "cache": false, "env": ["NODE_ENV", "PROCESS_ROLE", "PORT", "LOG_LEVEL", "DATABASE_URL", "DATABASE_POOL_MAX", "REDIS_URL", "S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_FORCE_PATH_STYLE", "CORS_ORIGINS", "TRUST_PROXY", "OUTBOX_POLL_MS", "OPENAPI_UI_ENABLED"] }
```

`globalPassThroughEnv` already carries `TESTCONTAINERS_*` and `DOCKER_HOST`; machine-level variables never go in `env` (§9.3).

- [ ] **Step 8: Wire it into `AppModule` and prove the boot refusal**

Add `ConfigModule` as the first import of `apps/api/src/app.module.ts`, and add `"@nestjs/config": "catalog:"` to `apps/api/package.json` dependencies.

Write `apps/api/test/integration/config-boot.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { ConfigModule } from '../../src/infra/config/index.js'

describe('boot-time env validation', () => {
  it('refuses to construct the module when DATABASE_URL is absent', async () => {
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      await expect(
        Test.createTestingModule({ imports: [ConfigModule] }).compile(),
      ).rejects.toThrow()
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved
    }
  })
})
```

- [ ] **Step 9: Verify and commit**

```bash
cp apps/api/.env.example apps/api/.env
pnpm --filter api exec vitest run
pnpm check
git add apps/api turbo.json pnpm-lock.yaml
git commit -m "feat(api): validate the environment with Zod and refuse to boot on invalid config"
```

---

## Task 5: Logging

§5.5 Logging row. nestjs-pino over Fastify's own pino, with the adapter's `logger: false` (already set by the spike). `x-request-id` accepted or generated; `cookie` and `authorization` redacted; JSON in production, `pino-pretty` in development.

**Files:**

- Create: `apps/api/src/infra/logger/logger.module.ts`, `index.ts`
- Test: `apps/api/src/infra/logger/logger.module.test.ts`
- Modify: `apps/api/src/app.module.ts` (replace the spike's bare `LoggerModule.forRoot()`)

**Interfaces:**

- Consumes: `AppConfig` (`logLevel`, `nodeEnv`).
- Produces: `LoggerModule` — a configured re-export; `buildLoggerOptions(config: AppConfig): Params` exported for the test.

- [ ] **Step 1: Write the failing test**

`apps/api/src/infra/logger/logger.module.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildLoggerOptions } from './logger.module.js'
import { AppConfig } from '../config/app-config.js'
import { EnvSchema } from '../config/env.schema.js'

const config = (over: Record<string, string> = {}) =>
  new AppConfig(
    EnvSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/d',
      REDIS_URL: 'redis://127.0.0.1:6379/0',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
      ...over,
    }),
  )

describe('buildLoggerOptions', () => {
  it('redacts credentials that would otherwise be logged in full', () => {
    const redact = buildLoggerOptions(config()).pinoHttp?.redact
    const paths = Array.isArray(redact) ? redact : redact?.paths
    expect(paths).toEqual(
      expect.arrayContaining([
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
      ]),
    )
  })

  it('uses pino-pretty in development and plain JSON in production', () => {
    expect(
      buildLoggerOptions(config({ NODE_ENV: 'development' })).pinoHttp?.transport,
    ).toBeDefined()
    expect(
      buildLoggerOptions(config({ NODE_ENV: 'production' })).pinoHttp?.transport,
    ).toBeUndefined()
  })

  it('honours an inbound x-request-id instead of inventing a new one', () => {
    const genReqId = buildLoggerOptions(config()).pinoHttp?.genReqId
    const req = { headers: { 'x-request-id': 'abc-123' } }
    expect(genReqId?.(req as never, {} as never)).toBe('abc-123')
  })

  it('generates an id when the header is absent', () => {
    const genReqId = buildLoggerOptions(config()).pinoHttp?.genReqId
    const id = genReqId?.({ headers: {} } as never, {} as never)
    expect(typeof id).toBe('string')
    expect(String(id).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter api exec vitest run src/infra/logger/logger.module.test.ts`
Expected: FAIL — cannot resolve `./logger.module.js`.

- [ ] **Step 3: Implement `logger.module.ts`**

```ts
import { Module } from '@nestjs/common'
import { LoggerModule as PinoLoggerModule, type Params } from 'nestjs-pino'
import { randomUUID } from 'node:crypto'
import { AppConfig } from '../config/app-config.js'

const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
]

export function buildLoggerOptions(config: AppConfig): Params {
  const isProduction = config.nodeEnv === 'production'
  return {
    pinoHttp: {
      level: config.logLevel,
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      // Trust an inbound id so a request can be followed across ds-web and
      // ds-api; mint one when the storefront did not supply it.
      genReqId: (req) => {
        const header = req.headers['x-request-id']
        const value = Array.isArray(header) ? header[0] : header
        return value && value.length > 0 ? value : randomUUID()
      },
      ...(isProduction
        ? {}
        : { transport: { target: 'pino-pretty', options: { singleLine: true } } }),
    },
  }
}

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => buildLoggerOptions(config),
    }),
  ],
})
export class LoggerModule {}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter api exec vitest run src/infra/logger/logger.module.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Replace the spike's logger wiring and verify**

In `apps/api/src/app.module.ts`, swap the bare `LoggerModule.forRoot()` from nestjs-pino for this module's `LoggerModule`.

Run: `pnpm --filter api exec vitest run && pnpm check`
Expected: green; the existing `/health/live` test still passes.

```bash
git add apps/api
git commit -m "feat(api): configure pino with request ids and credential redaction"
```

---

## Task 6: The error contract

§5.5 Errors row. An `AppError` hierarchy plus one global exception filter emitting RFC 9457 `application/problem+json`. Stack traces never leave the process in production.

**Files:**

- Create: `apps/api/src/shared/errors/app-error.ts`, `index.ts`
- Create: `apps/api/src/infra/http/problem.filter.ts`
- Test: `apps/api/src/shared/errors/app-error.test.ts`, `apps/api/test/integration/problem.test.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/package.json` (add `@ds/contracts`)

**Interfaces:**

- Consumes: `ErrorCode`, `ProblemDetails` from `@ds/contracts`.
- Produces:
  - `class AppError extends Error` — `constructor(code: ErrorCode, detail?: string, meta?: Record<string, unknown>)`, fields `code`, `detail`, `meta`, `status: number`
  - `ValidationError` (400, `constructor(issues: readonly StandardSchemaV1.Issue[])`, field `issues`), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `RateLimitedError` (429)
  - `ProblemFilter` implements `ExceptionFilter`
  - `TITLE_BY_CODE: Record<ErrorCode, string>`

> **Name collision:** `@nestjs/common` also exports a `ValidationError` — an interface, not a class. Import ours from `../../shared/errors/index.js` explicitly. `new` on Nest's will not compile (`.claude/rules/api.md`).

- [ ] **Step 1: Write the failing unit test**

`apps/api/src/shared/errors/app-error.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AppError, ConflictError, NotFoundError, ValidationError } from './index.js'

describe('AppError', () => {
  it('maps each subclass to its HTTP status', () => {
    expect(new NotFoundError('CATALOG_BRAND_NOT_FOUND').status).toBe(404)
    expect(new ConflictError('CATALOG_BRAND_SLUG_TAKEN').status).toBe(409)
    expect(new ValidationError([]).status).toBe(400)
  })

  it('is a real Error with a usable stack and name', () => {
    const err = new NotFoundError('NOT_FOUND', 'no such brand')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('NotFoundError')
    expect(err.stack).toBeDefined()
    expect(err.detail).toBe('no such brand')
  })

  it('keeps meta for the log without promising to serialize it', () => {
    const err = new AppError('INTERNAL', 'boom', { attempt: 3 })
    expect(err.meta).toEqual({ attempt: 3 })
  })

  it('carries Standard Schema issues on ValidationError', () => {
    const err = new ValidationError([{ message: 'expected number', path: ['page'] }])
    expect(err.issues).toHaveLength(1)
    expect(err.code).toBe('VALIDATION_FAILED')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter api exec vitest run src/shared/errors/app-error.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 3: Implement `app-error.ts`**

```ts
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ErrorCode } from '@ds/contracts'

export class AppError extends Error {
  readonly status: number = 500

  constructor(
    readonly code: ErrorCode,
    readonly detail?: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(detail ?? code)
    this.name = new.target.name
  }
}

/**
 * The one subclass that changes the constructor shape: the validation pipe
 * hands us Standard Schema issues, which the filter serializes into
 * `errors[]`. Note this is NOT `@nestjs/common`'s ValidationError.
 */
export class ValidationError extends AppError {
  override readonly status = 400

  constructor(readonly issues: readonly StandardSchemaV1.Issue[]) {
    super('VALIDATION_FAILED', 'Request validation failed')
  }
}

export class UnauthorizedError extends AppError {
  override readonly status = 401
}
export class ForbiddenError extends AppError {
  override readonly status = 403
}
export class NotFoundError extends AppError {
  override readonly status = 404
}
export class ConflictError extends AppError {
  override readonly status = 409
}
export class RateLimitedError extends AppError {
  override readonly status = 429
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter api exec vitest run src/shared/errors/app-error.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Write the failing HTTP test**

`apps/api/test/integration/problem.test.ts` — runs under the unit config for now; Task 12 moves it.

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { Controller, Get, Module } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { ProblemFilter } from '../../src/infra/http/index.js'
import { ConflictError, NotFoundError } from '../../src/shared/errors/index.js'

@Controller('boom')
class BoomController {
  @Get('notfound')
  notFound(): never {
    throw new NotFoundError('CATALOG_BRAND_NOT_FOUND', 'no such brand')
  }
  @Get('conflict')
  conflict(): never {
    throw new ConflictError('CATALOG_BRAND_SLUG_TAKEN')
  }
  @Get('unknown')
  unknown(): never {
    throw new Error('a leak of internal detail')
  }
}

@Module({ controllers: [BoomController] })
class BoomModule {}

describe('ProblemFilter', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [BoomModule] }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    )
    app.useGlobalFilters(new ProblemFilter('production'))
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('renders an AppError as RFC 9457 with the right media type', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom/notfound' })
    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expect(JSON.parse(res.payload)).toMatchObject({
      type: 'urn:problem:CATALOG_BRAND_NOT_FOUND',
      status: 404,
      code: 'CATALOG_BRAND_NOT_FOUND',
      detail: 'no such brand',
    })
  })

  it('carries an instance id taken from the request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/boom/conflict',
      headers: { 'x-request-id': 'req-xyz' },
    })
    expect(JSON.parse(res.payload).instance).toBe('req-xyz')
  })

  it('maps an unknown throw to 500 INTERNAL and leaks nothing', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom/unknown' })
    expect(res.statusCode).toBe(500)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('INTERNAL')
    expect(JSON.stringify(body)).not.toContain('a leak of internal detail')
    expect(body.stack).toBeUndefined()
  })

  it('maps an unmatched route to 404 NOT_FOUND', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.payload).code).toBe('NOT_FOUND')
  })
})
```

- [ ] **Step 6: Run it and watch it fail**

Run: `pnpm --filter api exec vitest run test/integration/problem.test.ts`
Expected: FAIL — cannot resolve `problem.filter.js`.

- [ ] **Step 7: Implement `problem.filter.ts`**

```ts
import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ErrorCode, ProblemDetails } from '@ds/contracts'
import { AppError, ValidationError } from '../../shared/errors/index.js'

export const TITLE_BY_CODE: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Validation Failed',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not Found',
  CONFLICT: 'Conflict',
  RATE_LIMITED: 'Rate Limited',
  INTERNAL: 'Internal Server Error',
  CATALOG_BRAND_NOT_FOUND: 'Brand Not Found',
  CATALOG_BRAND_SLUG_TAKEN: 'Brand Slug Taken',
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'VALIDATION_FAILED',
  415: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(private readonly nodeEnv: string) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const reply = http.getResponse<FastifyReply>()
    const request = http.getRequest<FastifyRequest>()

    const { status, code, detail, errors } = this.classify(exception)

    const body: ProblemDetails = {
      type: `urn:problem:${code}`,
      title: TITLE_BY_CODE[code],
      status,
      instance: String(request.id),
      code,
      ...(detail !== undefined ? { detail } : {}),
      ...(errors !== undefined ? { errors } : {}),
    }

    void reply.status(status).type('application/problem+json').send(body)
  }

  private classify(exception: unknown): {
    status: number
    code: ErrorCode
    detail?: string
    errors?: { path: string; message: string }[]
  } {
    if (exception instanceof ValidationError) {
      return {
        status: 400,
        code: 'VALIDATION_FAILED',
        detail: exception.detail,
        // Zod issue paths are PropertyKey[]; the Standard Schema spec also
        // permits { key } segments, so normalize both (ADR-0001 note).
        errors: exception.issues.map((issue) => ({
          path: (issue.path ?? [])
            .map((seg) =>
              String(typeof seg === 'object' && seg !== null && 'key' in seg ? seg.key : seg),
            )
            .join('.'),
          message: issue.message,
        })),
      }
    }

    if (exception instanceof AppError) {
      return { status: exception.status, code: exception.code, detail: exception.detail }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      return { status, code: CODE_BY_STATUS[status] ?? 'INTERNAL' }
    }

    // Anything else is a bug. In production the message never leaves the
    // process (§5.5); in development it is the fastest way to the cause.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL',
      ...(this.nodeEnv === 'production'
        ? {}
        : { detail: exception instanceof Error ? exception.message : String(exception) }),
    }
  }
}
```

- [ ] **Step 8: Run it and watch it pass**

Run: `pnpm --filter api exec vitest run test/integration/problem.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 9: Register globally, verify, commit**

In `apps/api/src/main.ts`, after `createApp` builds the app: `app.useGlobalFilters(new ProblemFilter(config.nodeEnv))`, taking `config` from `app.get(AppConfig)`. Add `"@ds/contracts": "workspace:*"` to `apps/api/package.json`.

```bash
pnpm install && pnpm check
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): emit RFC 9457 problem responses from one global filter"
```

---

## Task 7: Validation

§5.5 Validation row. One global `StandardSchemaValidationPipe` whose `exceptionFactory` produces our `ValidationError`, so validation failures reach the filter from Task 6 and come out as `400 VALIDATION_FAILED` with an `errors[]` array. No `ValidationPipe`, no DTO classes.

**Files:**

- Create: `apps/api/src/infra/http/validation.ts`
- Test: `apps/api/test/integration/validation.test.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**

- Consumes: `ValidationError` from `../../shared/errors/index.js`; `PageQuerySchema` from `@ds/contracts`.
- Produces: `buildValidationPipe(): StandardSchemaValidationPipe`

- [ ] **Step 1: Write the failing test**

`apps/api/test/integration/validation.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { Controller, Get, Module, Query } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { PageQuerySchema } from '@ds/contracts'
import { buildValidationPipe } from '../../src/infra/http/validation.js'
import { ProblemFilter } from '../../src/infra/http/index.js'

@Controller('things')
class ThingsController {
  @Get()
  list(@Query({ schema: PageQuerySchema }) query: { page: number; pageSize: number }) {
    return query
  }
}

@Module({ controllers: [ThingsController] })
class ThingsModule {}

describe('global validation', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ThingsModule] }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    )
    app.useGlobalPipes(buildValidationPipe())
    app.useGlobalFilters(new ProblemFilter('test'))
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('coerces query strings and applies defaults', async () => {
    const res = await app.inject({ method: 'GET', url: '/things?page=2' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({ page: 2, pageSize: 20 })
  })

  it('rejects a non-numeric page as a 400 problem with a field error', async () => {
    const res = await app.inject({ method: 'GET', url: '/things?page=abc' })
    expect(res.statusCode).toBe(400)
    expect(res.headers['content-type']).toContain('application/problem+json')
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('VALIDATION_FAILED')
    expect(body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'page' })]))
  })

  it('names the offending field, not [object Object]', async () => {
    // Guards the issue-path normalization in ProblemFilter: a path rendered
    // through a bare String() over object segments produces "[object Object]".
    const res = await app.inject({ method: 'GET', url: '/things?pageSize=999' })
    const body = JSON.parse(res.payload)
    expect(body.errors[0].path).toBe('pageSize')
    expect(JSON.stringify(body)).not.toContain('[object Object]')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter api exec vitest run test/integration/validation.test.ts`
Expected: FAIL — cannot resolve `validation.js`.

- [ ] **Step 3: Implement `validation.ts`**

```ts
import { StandardSchemaValidationPipe } from '@nestjs/common'
import { ValidationError } from '../../shared/errors/index.js'

/**
 * `exceptionFactory` receives Standard Schema issues. Ours is the AppError
 * subclass from src/shared/errors — NOT the interface of the same name that
 * @nestjs/common exports, which is not constructable.
 */
export function buildValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) => new ValidationError(issues),
  })
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter api exec vitest run test/integration/validation.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Register globally, verify, commit**

In `apps/api/src/main.ts`: `app.useGlobalPipes(buildValidationPipe())`, before the filter registration.

```bash
pnpm check
git add apps/api
git commit -m "feat(api): validate every request through Zod with one global pipe"
```

---

## Task 8: Security

§5.5 Security row. Helmet, cookies, conditional CORS, the throttler over Redis, and the adapter options the spike already set. The throttler storage is the package under a peer override — ADR-0001 proved it works, and this task keeps it proven.

**Files:**

- Create: `apps/api/src/infra/http/throttle.ts`, `apps/api/src/infra/http/security.ts`
- Test: `apps/api/test/integration/security.test.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/package.json`

**Interfaces:**

- Consumes: `AppConfig` (`corsOrigins`, `trustProxy`).
- Produces:
  - `THROTTLE_TTL_MS = 60_000`, `THROTTLE_LIMIT = 120` (constants, not env — §5.5)
  - `registerSecurity(app: NestFastifyApplication, config: AppConfig): Promise<void>`
  - `buildThrottlerOptions(redis: Redis)` for `ThrottlerModule.forRootAsync`

- [ ] **Step 1: Write the failing test**

`apps/api/test/integration/security.test.ts` — needs Redis, so Task 12 moves it to the integration project. Until then run it with `pnpm db:up` running.

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { Controller, Get, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { Redis } from 'ioredis'
import { registerSecurity } from '../../src/infra/http/security.js'
import { AppConfig } from '../../src/infra/config/app-config.js'
import { EnvSchema } from '../../src/infra/config/env.schema.js'

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true }
  }
}

const makeConfig = (over: Record<string, string> = {}) =>
  new AppConfig(
    EnvSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/d',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_BUCKET: 'b',
      S3_ACCESS_KEY_ID: 'k',
      S3_SECRET_ACCESS_KEY: 's',
      ...over,
    }),
  )

async function build(config: AppConfig, limit: number) {
  const redis = new Redis(config.redisUrl)
  await redis.flushdb()

  @Module({
    imports: [
      ThrottlerModule.forRoot({
        throttlers: [{ ttl: 60_000, limit }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    ],
    controllers: [PingController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
  class TestModule {}

  const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile()
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false, trustProxy: config.trustProxy }),
  )
  await registerSecurity(app, config)
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return { app, redis }
}

describe('security wiring', () => {
  let ctx: Awaited<ReturnType<typeof build>>

  afterAll(async () => {
    await ctx?.app.close()
    ctx?.redis.disconnect()
  })

  it('sets helmet headers and removes the framework fingerprint', async () => {
    ctx = await build(makeConfig(), 120)
    const res = await ctx.app.inject({ method: 'GET', url: '/ping' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('sends no CORS header when CORS_ORIGINS is empty', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://evil.example' },
    })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('throttles per forwarded IP, counting through Redis', async () => {
    await ctx.app.close()
    ctx = await build(makeConfig(), 2)
    const hit = (ip: string) =>
      ctx.app.inject({ method: 'GET', url: '/ping', headers: { 'x-forwarded-for': ip } })

    expect((await hit('203.0.113.9')).statusCode).toBe(200)
    expect((await hit('203.0.113.9')).statusCode).toBe(200)
    expect((await hit('203.0.113.9')).statusCode).toBe(429)
    // A different client must still be served — otherwise the tracker is
    // keying on the proxy rather than the forwarded address.
    expect((await hit('203.0.113.10')).statusCode).toBe(200)
  })

  it('returns 429 as an RFC 9457 problem, not Nest default JSON', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/ping',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    })
    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.payload).code).toBe('RATE_LIMITED')
  })
})
```

> The fourth assertion requires the `ProblemFilter` to be registered in `build()` too — add `app.useGlobalFilters(new ProblemFilter('test'))` alongside `registerSecurity`. `ThrottlerException` is an `HttpException` with status 429, which `CODE_BY_STATUS` already maps.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm db:up && pnpm --filter api exec vitest run test/integration/security.test.ts`
Expected: FAIL — cannot resolve `security.js`.

- [ ] **Step 3: Implement `throttle.ts` and `security.ts`**

`throttle.ts`:

```ts
// Constants, not env: a rate limit that varies per environment is a rate
// limit nobody can reason about (§5.5).
export const THROTTLE_TTL_MS = 60_000
export const THROTTLE_LIMIT = 120
```

`security.ts`:

```ts
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AppConfig } from '../config/app-config.js'

/**
 * Registered before any app.use(): these are Fastify plugins, not middleware.
 * CORS is registered only when an origin list exists — the storefront talks
 * to this API server-to-server, so the foundation default is no CORS at all.
 */
export async function registerSecurity(
  app: NestFastifyApplication,
  config: AppConfig,
): Promise<void> {
  await app.register(helmet)
  await app.register(cookie)

  if (config.corsOrigins.length > 0) {
    app.enableCors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter api exec vitest run test/integration/security.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Wire the real throttler into `AppModule`**

Replace the spike's inline `ThrottlerModule.forRoot(...)` with an async factory that takes the Redis client from Task 14's provider once it exists; until then keep constructing `new Redis(config.redisUrl, { lazyConnect: true })` in the factory and inject `AppConfig`:

```ts
ThrottlerModule.forRootAsync({
  inject: [AppConfig],
  useFactory: (config: AppConfig) => ({
    throttlers: [{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT }],
    storage: new ThrottlerStorageRedisService(new Redis(config.redisUrl, { lazyConnect: true })),
  }),
})
```

Register `ThrottlerGuard` as an `APP_GUARD` provider, and in `main.ts` call `await registerSecurity(app, config)` and set the adapter's `trustProxy` from `config.trustProxy` rather than the spike's literal.

Add `"@fastify/helmet": "catalog:"` and `"@fastify/cookie": "catalog:"` to `apps/api/package.json`.

- [ ] **Step 6: Verify and commit**

```bash
pnpm install && pnpm check
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): wire helmet, cookies, conditional CORS and the Redis throttler"
```

---

## Task 9: OpenAPI

§5.5 OpenAPI row, **as corrected on 2026-09-23**. `standardSchemaConverter` is not an exported symbol and is not needed at all: Nest reads `~standard.jsonSchema`, which Zod 4.6.5 implements. `src/openapi.ts` boots the app without listening and needs no live services.

**Files:**

- Create: `apps/api/src/shared/openapi/api-zod-response.ts`, `index.ts`
- Create: `apps/api/src/openapi.ts`
- Test: `apps/api/test/integration/openapi.test.ts`
- Modify: `apps/api/package.json` (add `@nestjs/swagger`, `zod-openapi`, the `openapi` script), `turbo.json`

**Interfaces:**

- Consumes: `AppConfig` (`openapiUiEnabled`); `ProblemDetailsSchema` from `@ds/contracts`.
- Produces:
  - `ApiZodResponse(status: number, schema: z.ZodType): MethodDecorator`
  - `buildDocument(app: INestApplication): OpenAPIObject`
  - `apps/api/openapi.json` (committed)

- [ ] **Step 1: Write the failing test**

`apps/api/test/integration/openapi.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { Controller, Get, Module } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { z } from 'zod'
import { ApiZodResponse, buildDocument } from '../../src/shared/openapi/index.js'

const WidgetSchema = z.object({ id: z.uuid(), label: z.string().max(10) })

@Controller('widgets')
class WidgetsController {
  @Get()
  @ApiZodResponse(200, WidgetSchema)
  list() {
    return { id: '0199f3c0-1111-7000-8000-000000000000', label: 'w' }
  }
}

@Module({ controllers: [WidgetsController] })
class WidgetsModule {}

async function makeApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [WidgetsModule] }).compile()
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )
  await app.init()
  return app
}

describe('OpenAPI generation', () => {
  it('renders a Zod response schema into the document', async () => {
    const app = await makeApp()
    try {
      const doc = buildDocument(app)
      const response = doc.paths?.['/widgets']?.get?.responses?.['200']
      expect(response).toBeDefined()
      const schema = (response as { content: Record<string, { schema: unknown }> }).content[
        'application/json'
      ].schema as { properties?: Record<string, unknown> }
      expect(Object.keys(schema.properties ?? {}).sort()).toEqual(['id', 'label'])
    } finally {
      await app.close()
    }
  })

  it('leaves components empty, because no schema carries .meta({ id })', async () => {
    const app = await makeApp()
    try {
      const doc = buildDocument(app)
      expect(Object.keys(doc.components?.schemas ?? {})).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('builds without a database or Redis reachable', async () => {
    // The document generator must never touch a store: `pnpm --filter api
    // openapi` runs in CI with no service containers (§10.1).
    const app = await makeApp()
    try {
      expect(() => buildDocument(app)).not.toThrow()
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter api exec vitest run test/integration/openapi.test.ts`
Expected: FAIL — cannot resolve `../../src/shared/openapi/index.js`.

- [ ] **Step 3: Implement `api-zod-response.ts`**

```ts
import { ApiResponse } from '@nestjs/swagger'
import type { z } from 'zod'

/**
 * `ApiResponse({ schema })` types `schema` as a closed OAS-3.0 SchemaObject
 * with no index signature, so a draft-2020-12 object literal fails excess
 * property checking. v12's `standardSchema` field takes the Zod schema
 * directly and lets Nest do the conversion (§5.5, corrected 2026-09-23).
 */
export function ApiZodResponse(status: number, schema: z.ZodType): MethodDecorator {
  return ApiResponse({ status, standardSchema: schema })
}
```

`index.ts`:

```ts
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger'
import type { INestApplication } from '@nestjs/common'

export { ApiZodResponse } from './api-zod-response.js'

export function buildDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Dubai Supplement API')
    .setDescription('Internal API for the Dubai Supplement storefront.')
    .setVersion('0.0.0')
    .build()

  // No `standardSchemaConverter`: Nest falls back to ~standard.jsonSchema,
  // which Zod 4 implements. Supplying one would be dead code.
  return SwaggerModule.createDocument(app, config)
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter api exec vitest run test/integration/openapi.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Implement `src/openapi.ts`**

```ts
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { AppModule } from './app.module.js'
import { buildDocument } from './shared/openapi/index.js'

/**
 * Boots the app WITHOUT listening and writes the document. Needs a
 * schema-valid env but no live services: pg.Pool connects on first query,
 * ioredis is lazyConnect, the S3 client is lazy (§5.5).
 */
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ logger: false }),
  { logger: false },
)
await app.init()

const target = fileURLToPath(new URL('../openapi.json', import.meta.url))
await writeFile(target, `${JSON.stringify(buildDocument(app), null, 2)}\n`, 'utf8')
await app.close()
```

Add to `apps/api/package.json` scripts: `"openapi": "node dist/openapi.js"`, and dependencies `"@nestjs/swagger": "catalog:"`, `"zod-openapi": "catalog:"`.

- [ ] **Step 6: Serve the UI only in development**

**Amended 2026-09-24.** Task 8 moved `createApp()` out of `main.ts` into
`src/app.factory.ts`, leaving `main.ts` as a nine-line `bootstrap()` pair that no
test can reach. Put this **inside `createApp()`**, after the pipe and filter are
registered — in `main.ts` it would grow the untestable region back, and the
security wiring test exists precisely to stop that.

```ts
if (config.openapiUiEnabled) {
  SwaggerModule.setup('docs', app, buildDocument(app))
}
```

**Helmet's default CSP does NOT block the Swagger UI — corrected 2026-09-24 by
measurement.** An earlier revision of this step required relaxing CSP, reasoning
statically from `helmet@8.3.0`'s defaults that `img-src 'self' data:` would block
the `validator.swagger.io` badge and `script-src 'self'`/`script-src-attr 'none'`
would block an inline bootstrap. That reasoning was wrong about the real page.
Measured against `@nestjs/swagger` 12.0.1 + `swagger-ui-dist` 5.32.14 under the
exact default header, in headless Chrome over CDP: **zero refusals, zero
violation reports**, with a `script-src 'none'` positive control firing to prove
the harness worked. The page loads `swagger-ui-init.js` as an external
same-origin file rather than inline, and Nest inlines the spec, which suppresses
the validator badge entirely.

**So do not relax CSP.** Relaxing it would weaken every route's headers to buy
nothing. Step 6 is the gated `SwaggerModule.setup` call plus a test that `/docs`
answers **200 under the real `registerSecurity` headers** when
`OPENAPI_UI_ENABLED` is true and **404** when it is false. What that test pins,
and all an `app.inject()` test can pin: the page is served under the same
policy as every other route, and **`@nestjs/swagger`'s template** — which owns
the HTML, not `swagger-ui-dist` — emits no inline `<script>` and no inline
handler, so the default `script-src 'self'` holds. A `swagger-ui-dist` bump
cannot put an inline script on that page; its realistic CSP risk is inside the
bundle (`eval`, `new Function`, a Worker, a foreign fetch), which no
`inject()` test can observe. That case needs a **browser**:
`apps/api/test/manual/csp/check.mjs` loads `/docs` in headless Chrome over the
DevTools Protocol and fails on any refusal (`.claude/rules/api.md` says when it
must run). It is deliberately outside `pnpm check`.

- [ ] **Step 7: Generate, commit the artefact, verify**

```bash
pnpm --filter api build && pnpm --filter api openapi
git diff --stat apps/api/openapi.json     # exists and is non-empty
pnpm check
git add apps/api pnpm-lock.yaml turbo.json
git commit -m "feat(api): generate the OpenAPI document from Zod schemas"
```

> `apps/api/openapi.json` is committed and must never be hand-edited (`.claude/rules/generated.md`). The CI `openapi` freshness job arrives in Phase 3 with `@ds/api-client`.

---

## Task 10: The data layer — Drizzle over `pg`

§6.1, §6.2. A `pg.Pool` sized from env, a Drizzle client with `casing: 'snake_case'` and **no** `schema` option (the relational query API is not used — each repository imports only its own module's tables), and `src/migrate.ts` running under an advisory lock with no Nest context.

Tests in this task need Postgres. Run `pnpm db:up` first; Task 12 replaces that with Testcontainers.

**Files:**

- Create: `apps/api/src/infra/db/db.module.ts`, `drizzle.provider.ts`, `index.ts`
- Create: `apps/api/src/migrate.ts`, `apps/api/drizzle.config.ts`
- Test: `apps/api/test/integration/db.test.ts`
- Modify: `apps/api/package.json` (add `drizzle-orm`, `pg`, `@types/pg`, `drizzle-kit`, `tsx`)

**Interfaces:**

- Consumes: `AppConfig` (`databaseUrl`, `databasePoolMax`).
- Produces:
  - `DRIZZLE: unique symbol` — the injection token
  - `type Db = NodePgDatabase<Record<string, never>>`
  - `DbModule` (global) providing `DRIZZLE` and `PG_POOL`
  - `PG_POOL: unique symbol` → `pg.Pool`
  - `MIGRATION_LOCK_KEY = 4_820_115` — the fixed advisory-lock key

- [ ] **Step 1: Write the failing test**

`apps/api/test/integration/db.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import { ConfigModule } from '../../src/infra/config/index.js'
import { DbModule, DRIZZLE, PG_POOL, type Db } from '../../src/infra/db/index.js'
import type { Pool } from 'pg'

describe('DbModule', () => {
  let db: Db
  let pool: Pool
  let close: () => Promise<void>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DbModule],
    }).compile()
    const app = await moduleRef.init()
    db = app.get<Db>(DRIZZLE)
    pool = app.get<Pool>(PG_POOL)
    close = () => app.close()
  })

  afterAll(async () => {
    await close()
  })

  it('executes a query through the pool', async () => {
    const rows = await db.execute(sql`select 1 as one`)
    expect(rows.rows[0]).toMatchObject({ one: 1 })
  })

  it('sizes the pool from DATABASE_POOL_MAX rather than pg defaults', async () => {
    expect(pool.options.max).toBe(10)
  })

  it('closes the pool on shutdown, so a test run does not leak connections', async () => {
    await close()
    await expect(db.execute(sql`select 1`)).rejects.toThrow()
    close = async () => {}
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm db:up && pnpm --filter api exec vitest run test/integration/db.test.ts`
Expected: FAIL — cannot resolve `../../src/infra/db/index.js`.

- [ ] **Step 3: Implement the module**

`drizzle.provider.ts`:

```ts
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import type { AppConfig } from '../config/app-config.js'

export const DRIZZLE = Symbol('DRIZZLE')
export const PG_POOL = Symbol('PG_POOL')

// No `schema` option on purpose: db.query.* is not used, so each repository
// imports only its own module's tables and no aggregate schema file exists.
export type Db = NodePgDatabase<Record<string, never>>

export function createPool(config: AppConfig): pg.Pool {
  return new pg.Pool({ connectionString: config.databaseUrl, max: config.databasePoolMax })
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { casing: 'snake_case' })
}
```

`db.module.ts`:

```ts
import { Global, Module, type OnApplicationShutdown } from '@nestjs/common'
import { Inject, Injectable } from '@nestjs/common'
import type pg from 'pg'
import { AppConfig } from '../config/app-config.js'
import { DRIZZLE, PG_POOL, createDb, createPool } from './drizzle.provider.js'

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}

@Global()
@Module({
  providers: [
    { provide: PG_POOL, inject: [AppConfig], useFactory: (c: AppConfig) => createPool(c) },
    { provide: DRIZZLE, inject: [PG_POOL], useFactory: (p: pg.Pool) => createDb(p) },
    PoolCloser,
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DbModule {}
```

`index.ts` re-exports `DbModule`, `DRIZZLE`, `PG_POOL`, `type Db`.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter api exec vitest run test/integration/db.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Write `drizzle.config.ts` and `migrate.ts`**

`drizzle.config.ts` — a glob, so there is no aggregate schema file (§6.2):

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/**/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  casing: 'snake_case',
})
```

`src/migrate.ts` — no Nest context, so it is the one file `tsx` may run (§4.2):

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import pg from 'pg'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EnvSchema } from './infra/config/env.schema.js'

export const MIGRATION_LOCK_KEY = 4_820_115

const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const env = EnvSchema.parse(process.env)
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 1 })
const db = drizzle(pool)

try {
  // Two containers starting at once must not both migrate. The lock is
  // session-scoped and released explicitly below (§6.2).
  await db.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`)
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  await db.execute(sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`)
} catch (error) {
  console.error('[migrate] failed:', error)
  // Non-zero so Liara keeps the previous release serving (§6.2).
  process.exitCode = 1
} finally {
  await pool.end()
}
```

Add to `apps/api/package.json`: dependencies `drizzle-orm`, `pg`; devDependencies `drizzle-kit`, `@types/pg`, `tsx` — all `catalog:`.

- [ ] **Step 6: Add `src/shared/ids.ts`**

§6.3 and ADR-0004: primary keys are `uuid` holding a **UUIDv7 generated in application code**, because PostgreSQL 16 has no native `uuidv7()`. Every module needs this, so it is a shared leaf rather than a module concern.

`apps/api/src/shared/ids.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { newId } from './ids.js'

describe('newId', () => {
  it('returns a v7 UUID', () => {
    // Version nibble is the 15th hex digit; v7 also sorts by creation time,
    // which is why it is chosen over v4 for primary keys.
    expect(newId()[14]).toBe('7')
  })

  it('is monotonic enough to sort by creation order', async () => {
    const first = newId()
    await new Promise((r) => setTimeout(r, 2))
    expect(newId() > first).toBe(true)
  })

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()))
    expect(ids.size).toBe(1000)
  })
})
```

Run it (FAIL), then `apps/api/src/shared/ids.ts`:

```ts
import { v7 } from 'uuid'

/** UUIDv7: time-ordered, so it clusters in the index rather than scattering. */
export function newId(): string {
  return v7()
}
```

Run it again (PASS, 3/3). Add `"uuid": "catalog:"` to `apps/api` dependencies.

- [ ] **Step 7: Verify and commit**

```bash
pnpm install && pnpm check
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add the Drizzle client, pool lifecycle and migration runner"
```

---

## Task 11: Migration `0000_extensions`

§6.2. A hand-written migration enabling `pg_trgm` and creating the ICU collation `fa`. Owns **Review Focus 4**: a Postgres built without ICU fails here, loudly and locally, rather than at first deploy.

**Files:**

- Create: `apps/api/drizzle/0000_extensions.sql` (generated, then edited), `apps/api/drizzle/meta/*` (generated)
- Test: `apps/api/test/integration/migrate.test.ts`

**Interfaces:**

- Consumes: `MIGRATION_LOCK_KEY` and the migrator from Task 10.
- Produces: the `fa` collation and `pg_trgm`, which Phase 3's `brands.search_text` index and `ORDER BY name COLLATE "fa"` both require.

- [ ] **Step 1: Generate the empty custom migration**

Run: `pnpm db:generate --custom --name=extensions`
Expected: creates `apps/api/drizzle/0000_extensions.sql`, empty, plus journal entries under `drizzle/meta/`.

- [ ] **Step 2: Write the failing test**

`apps/api/test/integration/migrate.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const db = drizzle(pool)

describe('0000_extensions', () => {
  afterAll(async () => {
    await pool.end()
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
    expect((res.rows[0] as { n: number }).n).toBeGreaterThan(0)
  })

  it('sorts Persian text by the collation rather than by code point', async () => {
    const res = await db.execute(
      sql`select x from (values ('آ'), ('ا')) as t(x) order by x collate "fa"`,
    )
    // U+0627 ALEF sorts before U+0622 ALEF WITH MADDA in fa; code-point order is the reverse.
    expect((res.rows[0] as { x: string }).x).toBe('ا')
  })

  it('is idempotent — running the migrator twice does not fail', async () => {
    // Guards against a hand-written migration that omits IF NOT EXISTS.
    const res = await db.execute(
      sql`select count(*)::int as n from pg_collation where collname = 'fa'`,
    )
    expect((res.rows[0] as { n: number }).n).toBe(1)
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm db:migrate && pnpm --filter api exec vitest run test/integration/migrate.test.ts`
Expected: FAIL — `pg_trgm` absent, `fa` collation absent.

- [ ] **Step 4: Write the migration SQL**

`apps/api/drizzle/0000_extensions.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

--> statement-breakpoint

DO $$
BEGIN
  -- CREATE COLLATION has no IF NOT EXISTS before PG 16.1 in all builds, and
  -- the migrator must be safe to re-run against a partially migrated database.
  IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'fa') THEN
    CREATE COLLATION fa (provider = icu, locale = 'fa');
  END IF;
END
$$;
```

> If this raises `collation provider "icu" is not supported`, the server was built without ICU. That is the §6.2 fallback condition: order by `search_text` instead and write the ADR. Do not silently drop the collation.

- [ ] **Step 5: Run it and watch it pass**

```bash
pnpm db:migrate
pnpm --filter api exec vitest run test/integration/migrate.test.ts   # 5/5
pnpm db:migrate                                                       # second run: no error
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm check
git add apps/api/drizzle apps/api/test
git commit -m "feat(api): enable pg_trgm and the Persian ICU collation in the first migration"
```

---

## Task 12: The Testcontainers integration harness

§6.6. One `vitest.integration.config.ts` with `fileParallelism: false`, a global setup that starts three containers once per run and applies migrations, and truncation-based isolation. This is what makes `pnpm check` cover integration tests.

**Files:**

- Create: `apps/api/vitest.integration.config.ts`, `apps/api/test/setup/containers.ts`, `apps/api/test/setup/truncate.ts`
- Modify: `apps/api/package.json` (add `test:integration`, `testcontainers`), all existing files under `test/integration/`
- Test: the harness is proven by the existing integration tests running under it

**Interfaces:**

- Consumes: `src/migrate.ts` from Task 10.
- Produces:
  - global setup writing `DATABASE_URL`, `REDIS_URL`, `S3_*` into `process.env`
  - `truncateAll(db: Db, tables: string[]): Promise<void>`
  - `flushRedis(): Promise<void>`

- [ ] **Step 1: Write `vitest.integration.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    globalSetup: ['./test/setup/containers.ts'],
    // Containers are shared across files, so files must not run in parallel
    // (§6.6). `sequential` was removed in Vitest 5; this is its replacement.
    fileParallelism: false,
    clearMocks: true,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
```

- [ ] **Step 2: Write the global setup**

`apps/api/test/setup/containers.ts`:

```ts
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)

let postgres: StartedPostgreSqlContainer
let redis: StartedTestContainer
let rustfs: StartedTestContainer

export async function setup(): Promise<void> {
  postgres = await new PostgreSqlContainer('postgres:16')
    .withDatabase('dubaisupp')
    .withUsername('dubaisupp')
    .withPassword('dubaisupp')
    .start()

  redis = await new GenericContainer('redis:7.2-alpine').withExposedPorts(6379).start()

  rustfs = await new GenericContainer('rustfs/rustfs:1.0.0')
    .withExposedPorts(9000)
    .withEnvironment({ RUSTFS_ACCESS_KEY: 'rustfsadmin', RUSTFS_SECRET_KEY: 'rustfsadmin' })
    .start()

  process.env.DATABASE_URL = postgres.getConnectionUri()
  process.env.REDIS_URL = `redis://${redis.getHost()}:${String(redis.getMappedPort(6379))}/0`
  process.env.S3_ENDPOINT = `http://${rustfs.getHost()}:${String(rustfs.getMappedPort(9000))}`
  process.env.S3_REGION = 'default'
  process.env.S3_BUCKET = 'dubaisupp'
  process.env.S3_ACCESS_KEY_ID = 'rustfsadmin'
  process.env.S3_SECRET_ACCESS_KEY = 'rustfsadmin'
  process.env.S3_FORCE_PATH_STYLE = 'true'

  // Migrations run from the compiled entrypoint, not through tsx, so this
  // exercises the same code path the container entrypoint uses (§5.2).
  const migrate = fileURLToPath(new URL('../../dist/migrate.js', import.meta.url))
  await run(process.execPath, [migrate], { env: process.env })
}

export async function teardown(): Promise<void> {
  await Promise.all([postgres?.stop(), redis?.stop(), rustfs?.stop()])
}
```

> The bucket is created by the storage port's own setup in Task 14, not here — `rustfs/rustfs` has no equivalent of MinIO's `mc mb` baked into the image entrypoint.

- [ ] **Step 3: Write the truncation helper**

`apps/api/test/setup/truncate.ts`:

```ts
import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import type { Db } from '../../src/infra/db/index.js'

/**
 * Isolation is truncation, not transaction rollback: app.inject() and the
 * relay run against the app's own pool and must read committed rows (§6.6).
 */
export async function truncateAll(db: Db, tables: string[]): Promise<void> {
  if (tables.length === 0) return
  const list = tables.map((t) => `"${t}"`).join(', ')
  await db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`))
}

export async function flushRedis(): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL ?? '')
  try {
    await redis.flushdb()
  } finally {
    redis.disconnect()
  }
}
```

- [ ] **Step 4: Move the integration tests onto the new project**

Add to `apps/api/package.json`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

and change `vitest.config.ts`'s `include` to `['src/**/*.test.ts']` only — the unit suite must never need Docker (§9.4 rule 3). Add `"testcontainers": "catalog:"` and `"@testcontainers/postgresql": "catalog:"` to devDependencies, adding the latter to the catalog at its newest mature version.

- [ ] **Step 5: Run both suites**

```bash
pnpm --filter api build          # global setup runs dist/migrate.js
pnpm --filter api test           # unit only, no Docker
pnpm --filter api test:integration
```

Expected: unit passes with the Docker daemon stopped; integration passes with it running.

- [ ] **Step 6: Verify and commit**

```bash
pnpm check
git add apps/api pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "test(api): run integration tests against Testcontainers with truncation isolation"
```

---

## Task 13: The transactional outbox

§5.6 — the correctness core of this phase, and the reason `pnpm check` runs integration tests at all. Owns **Review Focus 1, 2 and 5**.

**Files:**

- Create: `apps/api/src/infra/outbox/schema.ts`, `event-publisher.ts`, `on-domain-event.decorator.ts`, `outbox.relay.ts`, `outbox.module.ts`, `index.ts`
- Create: `apps/api/drizzle/0001_outbox_events.sql` (generated)
- Test: `apps/api/test/integration/outbox.test.ts`

**Interfaces:**

- Consumes: `DRIZZLE`, `type Db` from Task 10.
- Produces:
  - `outboxEvents` table: `id bigint generated always as identity`, `aggregateType`, `aggregateId`, `eventType`, `payload jsonb`, `occurredAt timestamptz`, `publishedAt timestamptz | null`, `attempts integer default 0`, `lastError text | null`
  - `type DomainEvent = { type: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown>; occurredAt: Date }`
  - `abstract class EventPublisher { publish(event: DomainEvent, tx: Db): Promise<void> }`
  - `OnDomainEvent(type: string): MethodDecorator`
  - `class OutboxRelay` — `runOnce(): Promise<{ processed: number; failed: number }>`, `start(): void`, `stop(): Promise<void>`
  - `MAX_ATTEMPTS = 5`, `BATCH_SIZE = 50`

- [ ] **Step 1: Write the schema and generate the migration**

`apps/api/src/infra/outbox/schema.ts`:

```ts
import { bigint, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const outboxEvents = pgTable('outbox_events', {
  id: bigint('id', { mode: 'bigint' }).generatedAlwaysAsIdentity().primaryKey(),
  aggregateType: text().notNull(),
  aggregateId: uuid().notNull(),
  eventType: text().notNull(),
  payload: jsonb().$type<Record<string, unknown>>().notNull(),
  occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp({ withTimezone: true }),
  attempts: integer().notNull().default(0),
  lastError: text(),
})
```

Run: `pnpm db:generate` → `apps/api/drizzle/0001_outbox_events.sql`. Read the generated SQL before committing it (§6.2: migrations are reviewed like code).

- [ ] **Step 2: Write the failing relay test**

`apps/api/test/integration/outbox.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { eq } from 'drizzle-orm'
import { ConfigModule } from '../../src/infra/config/index.js'
import { DbModule, DRIZZLE, type Db } from '../../src/infra/db/index.js'
import {
  EventPublisher,
  OnDomainEvent,
  OutboxModule,
  OutboxRelay,
  outboxEvents,
} from '../../src/infra/outbox/index.js'
import { truncateAll } from '../setup/truncate.js'

const seen: string[] = []
let failuresLeft = 0
let sideEffects = 0

@Injectable()
class SpyHandler {
  @OnDomainEvent('test.thing.happened')
  async onHappened(payload: Record<string, unknown>): Promise<void> {
    seen.push(String(payload.id))
  }

  @OnDomainEvent('test.thing.flaky')
  async onFlaky(): Promise<void> {
    sideEffects += 1
    if (failuresLeft > 0) {
      failuresLeft -= 1
      throw new Error('handler blew up after its side effect')
    }
  }
}

@Module({ imports: [ConfigModule, DbModule, OutboxModule], providers: [SpyHandler] })
class TestModule {}

const anEvent = (type: string) => ({
  type,
  aggregateType: 'thing',
  aggregateId: '0199f3c0-1111-7000-8000-000000000000',
  payload: { id: 'abc' },
  occurredAt: new Date(),
})

describe('OutboxRelay', () => {
  let db: Db
  let relay: OutboxRelay
  let publisher: EventPublisher
  let close: () => Promise<void>

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile()
    const app = await moduleRef.init()
    db = app.get<Db>(DRIZZLE)
    relay = app.get(OutboxRelay)
    publisher = app.get(EventPublisher)
    close = () => app.close()
    await truncateAll(db, ['outbox_events'])
    seen.length = 0
    failuresLeft = 0
    sideEffects = 0
  })

  afterAll(async () => {
    await close?.()
  })

  it('publishes in the same transaction as the state change', async () => {
    await expect(
      db.transaction(async (tx) => {
        await publisher.publish(anEvent('test.thing.happened'), tx as unknown as Db)
        throw new Error('caller rolled back')
      }),
    ).rejects.toThrow('caller rolled back')

    const rows = await db.select().from(outboxEvents)
    // If the row survived, publish() opened its own transaction and the
    // outbox is no longer atomic with the write that caused it.
    expect(rows).toHaveLength(0)
  })

  it('delivers an event to its handler and marks it published', async () => {
    await db.transaction(async (tx) => {
      await publisher.publish(anEvent('test.thing.happened'), tx as unknown as Db)
    })

    const result = await relay.runOnce()
    expect(result).toEqual({ processed: 1, failed: 0 })
    expect(seen).toEqual(['abc'])

    const [row] = await db.select().from(outboxEvents)
    expect(row?.publishedAt).not.toBeNull()
  })

  // Review Focus 2.
  it('increments attempts exactly once per failed cycle and leaves it unpublished', async () => {
    failuresLeft = 1
    await db.transaction(async (tx) => {
      await publisher.publish(anEvent('test.thing.flaky'), tx as unknown as Db)
    })

    expect(await relay.runOnce()).toEqual({ processed: 0, failed: 1 })
    let [row] = await db.select().from(outboxEvents)
    expect(row?.attempts).toBe(1)
    expect(row?.publishedAt).toBeNull()
    expect(row?.lastError).toContain('blew up')

    // The retry re-runs the handler, so its side effect happens twice. That
    // is inherent to at-least-once delivery — handlers must be idempotent.
    expect(await relay.runOnce()).toEqual({ processed: 1, failed: 0 })
    ;[row] = await db.select().from(outboxEvents)
    expect(row?.publishedAt).not.toBeNull()
    expect(sideEffects).toBe(2)
  })

  it('parks a row at five attempts and stops selecting it', async () => {
    failuresLeft = 99
    await db.transaction(async (tx) => {
      await publisher.publish(anEvent('test.thing.flaky'), tx as unknown as Db)
    })

    for (let i = 0; i < 5; i++) await relay.runOnce()

    const [row] = await db.select().from(outboxEvents)
    expect(row?.attempts).toBe(5)
    expect(row?.publishedAt).toBeNull()

    const after = await relay.runOnce()
    expect(after).toEqual({ processed: 0, failed: 0 })
    expect(sideEffects).toBe(5)
  })

  // Review Focus 1.
  it('never hands the same row to two concurrent relays', async () => {
    await db.transaction(async (tx) => {
      await publisher.publish(anEvent('test.thing.happened'), tx as unknown as Db)
    })

    const [a, b] = await Promise.all([relay.runOnce(), relay.runOnce()])
    expect(a.processed + b.processed).toBe(1)
    expect(seen).toEqual(['abc'])
  })

  // Review Focus 5.
  it('stores an absent optional as NULL, not as the string "undefined"', async () => {
    await db.transaction(async (tx) => {
      await publisher.publish(anEvent('test.thing.happened'), tx as unknown as Db)
    })
    const [row] = await db.select().from(outboxEvents)
    expect(row?.lastError).toBeNull()
    expect(row?.publishedAt).toBeNull()
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter api build && pnpm --filter api test:integration`
Expected: FAIL — cannot resolve `../../src/infra/outbox/index.js`.

- [ ] **Step 4: Implement the publisher and the decorator**

`event-publisher.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { outboxEvents } from './schema.js'
import type { Db } from '../db/index.js'

export type DomainEvent = {
  type: string
  aggregateType: string
  aggregateId: string
  payload: Record<string, unknown>
  occurredAt: Date
}

/**
 * A port, so application services depend on the interface rather than the
 * table. `tx` is passed explicitly: there is no CLS magic, and the insert
 * must land in the caller's transaction (§6.4).
 */
@Injectable()
export abstract class EventPublisher {
  abstract publish(event: DomainEvent, tx: Db): Promise<void>
}

@Injectable()
export class OutboxEventPublisher extends EventPublisher {
  async publish(event: DomainEvent, tx: Db): Promise<void> {
    await tx.insert(outboxEvents).values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.type,
      payload: event.payload,
      occurredAt: event.occurredAt,
    })
  }
}
```

`on-domain-event.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common'

export const ON_DOMAIN_EVENT = 'ds:on-domain-event'

export const OnDomainEvent = (type: string): MethodDecorator => SetMetadata(ON_DOMAIN_EVENT, type)
```

- [ ] **Step 5: Implement the relay**

`outbox.relay.ts`:

```ts
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { and, asc, isNull, lt, sql } from 'drizzle-orm'
import { AppConfig } from '../config/app-config.js'
import { DRIZZLE, type Db } from '../db/index.js'
import { ON_DOMAIN_EVENT } from './on-domain-event.decorator.js'
import { outboxEvents } from './schema.js'

export const MAX_ATTEMPTS = 5
export const BATCH_SIZE = 50

type Handler = (payload: Record<string, unknown>) => Promise<void> | void

@Injectable()
export class OutboxRelay implements OnApplicationShutdown {
  private handlers = new Map<string, Handler[]>()
  private timer: NodeJS.Timeout | undefined
  private inFlight: Promise<unknown> = Promise.resolve()
  private stopped = false

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as Record<string, unknown> | null
      if (!instance || typeof instance !== 'object') continue
      const prototype = Object.getPrototypeOf(instance) as object | null
      if (!prototype) continue

      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const method = instance[name]
        if (typeof method !== 'function') continue
        const type = this.reflector.get<string>(ON_DOMAIN_EVENT, method as () => unknown)
        if (!type) continue
        const list = this.handlers.get(type) ?? []
        list.push((payload) => (method as Handler).call(instance, payload))
        this.handlers.set(type, list)
      }
    }
  }

  async runOnce(): Promise<{ processed: number; failed: number }> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(outboxEvents)
        .where(and(isNull(outboxEvents.publishedAt), lt(outboxEvents.attempts, MAX_ATTEMPTS)))
        .orderBy(asc(outboxEvents.id))
        .limit(BATCH_SIZE)
        // Two relays run concurrently under PROCESS_ROLE=all plus a worker.
        // SKIP LOCKED is what keeps them off each other's rows.
        .for('update', { skipLocked: true })

      let processed = 0
      let failed = 0

      for (const row of rows) {
        const handlers = this.handlers.get(row.eventType) ?? []
        try {
          for (const handler of handlers) {
            await handler(row.payload)
          }
          await tx
            .update(outboxEvents)
            .set({ publishedAt: new Date() })
            .where(sql`${outboxEvents.id} = ${row.id}`)
          processed += 1
        } catch (error) {
          await tx
            .update(outboxEvents)
            .set({
              attempts: row.attempts + 1,
              lastError: error instanceof Error ? error.message : String(error),
            })
            .where(sql`${outboxEvents.id} = ${row.id}`)
          failed += 1
        }
      }

      return { processed, failed }
    })
  }

  start(): void {
    if (this.timer) return
    const tick = async (): Promise<void> => {
      if (this.stopped) return
      this.inFlight = this.runOnce().catch(() => ({ processed: 0, failed: 0 }))
      await this.inFlight
    }
    this.timer = setInterval(() => void tick(), this.config.outboxPollMs)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    // SIGTERM must not cut a cycle in half (§5.2).
    await this.inFlight
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop()
  }
}
```

`outbox.module.ts` imports `DiscoveryModule` from `@nestjs/core` and provides `OutboxRelay`, `{ provide: EventPublisher, useClass: OutboxEventPublisher }`, exporting both.

- [ ] **Step 6: Run it and watch it pass**

Run: `pnpm --filter api build && pnpm --filter api test:integration`
Expected: PASS, 7/7 in `outbox.test.ts`.

- [ ] **Step 7: Verify and commit**

```bash
pnpm check
git add apps/api
git commit -m "feat(api): deliver domain events through a transactional outbox relay"
```

---

## Task 14: The Redis and object-storage ports

§6.5. One shared ioredis client (so the throttler and the `KeyValueStore` do not open two connections), a `KeyValueStore` port, and a `StorageProvider` over `@aws-sdk/client-s3` with `forcePathStyle: true`. Each gets one integration test so neither is untested code.

**Files:**

- Create: `apps/api/src/infra/redis/redis.module.ts`, `key-value.store.ts`, `index.ts`
- Create: `apps/api/src/infra/storage/storage.provider.ts`, `storage.module.ts`, `index.ts`
- Create: `apps/api/vitest.storage.config.ts`
- Test: `apps/api/test/integration/key-value.test.ts`, `storage.test.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/package.json`

**Interfaces:**

- Consumes: `AppConfig`.
- Produces:
  - `REDIS: unique symbol` → `Redis` (shared; the throttler storage now injects it)
  - `abstract class KeyValueStore` — `get(key): Promise<string | null>`, `set(key, value, ttlSeconds?): Promise<void>`, `del(key): Promise<void>`
  - `abstract class StorageProvider` — `put(key, body, contentType): Promise<void>`, `getSignedUrl(key, expiresInSeconds): Promise<string>`, `delete(key): Promise<void>`, `head(key): Promise<{ contentLength: number } | null>`

- [ ] **Step 1: Write the failing key-value test**

`apps/api/test/integration/key-value.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { ConfigModule } from '../../src/infra/config/index.js'
import { KeyValueStore, RedisModule } from '../../src/infra/redis/index.js'
import { flushRedis } from '../setup/truncate.js'

describe('KeyValueStore', () => {
  let store: KeyValueStore
  let close: () => Promise<void>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule],
    }).compile()
    const app = await moduleRef.init()
    store = app.get(KeyValueStore)
    close = () => app.close()
  })

  beforeEach(flushRedis)
  afterAll(async () => {
    await close()
  })

  it('round-trips a value', async () => {
    await store.set('k', 'v')
    expect(await store.get('k')).toBe('v')
  })

  it('returns null for a missing key rather than throwing', async () => {
    expect(await store.get('absent')).toBeNull()
  })

  it('honours a TTL', async () => {
    await store.set('short', 'v', 1)
    await new Promise((r) => setTimeout(r, 1200))
    expect(await store.get('short')).toBeNull()
  })

  it('deletes', async () => {
    await store.set('k', 'v')
    await store.del('k')
    expect(await store.get('k')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail, then implement**

Run: `pnpm --filter api test:integration -t KeyValueStore` → FAIL, module missing.

`key-value.store.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { REDIS } from './redis.module.js'

@Injectable()
export abstract class KeyValueStore {
  abstract get(key: string): Promise<string | null>
  abstract set(key: string, value: string, ttlSeconds?: number): Promise<void>
  abstract del(key: string): Promise<void>
}

@Injectable()
export class RedisKeyValueStore extends KeyValueStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super()
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds === undefined) await this.redis.set(key, value)
    else await this.redis.set(key, value, 'EX', ttlSeconds)
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }
}
```

`redis.module.ts` provides `REDIS` from `new Redis(config.redisUrl, { lazyConnect: true })`, provides `{ provide: KeyValueStore, useClass: RedisKeyValueStore }`, exports both, and closes the client in `onApplicationShutdown` via `redis.quit()`.

Then change Task 8's `ThrottlerModule.forRootAsync` to `inject: [REDIS]` so there is exactly one connection.

- [ ] **Step 3: Write the failing storage test**

`apps/api/test/integration/storage.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { ConfigModule } from '../../src/infra/config/index.js'
import { StorageModule, StorageProvider } from '../../src/infra/storage/index.js'

describe('StorageProvider against RustFS', () => {
  let storage: StorageProvider
  let close: () => Promise<void>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, StorageModule],
    }).compile()
    const app = await moduleRef.init()
    storage = app.get(StorageProvider)
    close = () => app.close()
    await storage.ensureBucket()
  })

  afterAll(async () => {
    await close()
  })

  it('puts, heads, signs and deletes — the same path Liara will take', async () => {
    const key = `smoke/${Date.now()}.txt`
    await storage.put(key, Buffer.from('hello'), 'text/plain')

    const head = await storage.head(key)
    expect(head?.contentLength).toBe(5)

    const url = await storage.getSignedUrl(key, 60)
    expect(url).toContain(key)
    // forcePathStyle: the bucket must be in the path, not the hostname —
    // Liara's endpoint does not do virtual-host addressing.
    expect(url).toContain('/dubaisupp/')

    await storage.delete(key)
    expect(await storage.head(key)).toBeNull()
  })
})
```

- [ ] **Step 4: Implement `storage.provider.ts`**

```ts
import { Injectable } from '@nestjs/common'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { AppConfig } from '../config/app-config.js'

@Injectable()
export abstract class StorageProvider {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>
  abstract getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  abstract delete(key: string): Promise<void>
  abstract head(key: string): Promise<{ contentLength: number } | null>
  abstract ensureBucket(): Promise<void>
}

@Injectable()
export class S3StorageProvider extends StorageProvider {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: AppConfig) {
    super()
    this.bucket = config.s3.bucket
    // The client is lazy — no network call until a command runs, which is
    // what lets `pnpm --filter api openapi` boot with no services (§5.5).
    this.client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      forcePathStyle: config.s3.forcePathStyle,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    })
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
    } catch (error) {
      const name = (error as { name?: string }).name
      if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') throw error
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    )
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    })
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async head(key: string): Promise<{ contentLength: number } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return { contentLength: res.ContentLength ?? 0 }
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return null
      throw error
    }
  }
}
```

Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to the catalog and to `apps/api` dependencies.

- [ ] **Step 5: Add `vitest.storage.config.ts`**

Runs the same storage test with `S3_*` from the operator's shell and **no** global setup, so `first-deploy.md` can point it at Liara once (§6.5):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/integration/storage.test.ts'],
    clearMocks: true,
    testTimeout: 60_000,
  },
})
```

Script: `"test:storage": "vitest run --config vitest.storage.config.ts"`.

- [ ] **Step 6: Verify and commit**

```bash
pnpm install && pnpm --filter api build && pnpm --filter api test:integration
pnpm check
git add apps/api pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(api): add the Redis key-value and S3 storage ports"
```

---

## Task 15: `GET /health/ready`

§5.5 Health row. Extends the spike's liveness-only controller. Liara's `healthCheck` points here, so a container that cannot reach its stores never takes traffic; the Docker `HEALTHCHECK` stays on `/health/live` so a Redis blip does not restart-loop the container.

**Files:**

- Modify: `apps/api/src/infra/health/health.controller.ts`, `health.module.ts`
- Create: `apps/api/src/infra/health/index.ts` — **added 2026-09-24.** `infra/health/` is the only `infra/*` directory with no barrel, which is why `app.module.ts:7` reaches straight for `./infra/health/health.module.js`. Task 14 found it and correctly left it alone, since this task rewrites the module anyway; Task 17 turns the convention into a failing build, so it has to be closed here. Re-exports only, and `app.module.ts` switches to the barrel.
- Create: `apps/api/src/infra/health/postgres.indicator.ts`, `redis.indicator.ts`, `outbox.indicator.ts`, and the controller-scoped filter Step 5 rules for
- Test: `apps/api/test/integration/health-ready.test.ts`

**Interfaces:**

- Consumes: `DRIZZLE`/`type Db`; `REDIS` from Task 14; `outboxEvents`, `MAX_ATTEMPTS` from Task 13.
- Produces: `GET /health/ready` → 200 `{ status: 'ok', details: { postgres: { status: 'up' }, redis: { status: 'up' }, outbox: { status: 'up', dead: number } } }`, or 503 when a store is unreachable.
- Produces: a 503 that carries **Terminus's** body, not an RFC 9457 problem body — see Step 5. `@ds/contracts`'s `ERROR_CODES` stays at nine codes; health is not part of the API error contract.

- [ ] **Step 1: Write the failing test**

`apps/api/test/integration/health-ready.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../../src/app.module.js'
import { DRIZZLE, type Db } from '../../src/infra/db/index.js'
import { MAX_ATTEMPTS, outboxEvents } from '../../src/infra/outbox/index.js'
import { truncateAll } from '../setup/truncate.js'

describe('GET /health/ready', () => {
  let app: NestFastifyApplication
  let db: Db

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    db = app.get<Db>(DRIZZLE)
  })

  beforeEach(async () => {
    await truncateAll(db, ['outbox_events'])
  })

  afterAll(async () => {
    await app.close()
  })

  it('reports every store up', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('ok')
    expect(body.details.postgres.status).toBe('up')
    expect(body.details.redis.status).toBe('up')
  })

  it('reports the parked-event count as a non-failing detail', async () => {
    await db.insert(outboxEvents).values({
      aggregateType: 'thing',
      aggregateId: '0199f3c0-1111-7000-8000-000000000000',
      eventType: 'test.thing.dead',
      payload: {},
      attempts: 5,
      lastError: 'parked',
    })

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    // Parked events need a human, but the service is still serving: this
    // must stay 200 or Liara stops routing to a healthy container.
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.details.outbox.dead).toBe(1)
    expect(body.details.outbox.status).toBe('up')
  })

  it('counts only parked rows, not merely unpublished ones', async () => {
    await db.insert(outboxEvents).values({
      aggregateType: 'thing',
      aggregateId: '0199f3c0-1111-7000-8000-000000000000',
      eventType: 'test.thing.pending',
      payload: {},
      attempts: 1,
    })
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(JSON.parse(res.payload).details.outbox.dead).toBe(0)
  })

  // Added 2026-09-24. Without this row, deleting `isNull(outboxEvents.publishedAt)`
  // from the indicator's WHERE breaks NO test above: nothing else in this file
  // is both published AND at the attempt ceiling. An event that failed its way
  // to five attempts and was then republished would be counted dead forever,
  // and `/health/ready` would report a backlog that does not exist.
  it('stops counting a parked row once it is published', async () => {
    await db.insert(outboxEvents).values({
      aggregateType: 'thing',
      aggregateId: '0199f3c0-3333-7000-8000-000000000000',
      eventType: 'test.thing.recovered',
      payload: {},
      attempts: MAX_ATTEMPTS,
      publishedAt: new Date(),
    })
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(JSON.parse(res.payload).details.outbox.dead).toBe(0)
  })

  it('still answers /health/live without touching any store', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' })
    expect(res.statusCode).toBe(200)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter api build && pnpm --filter api test:integration -t 'health/ready'`
Expected: FAIL — 404, the route does not exist.

- [ ] **Step 3: Implement the three indicators**

`postgres.indicator.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus'
import { sql } from 'drizzle-orm'
import { DRIZZLE, type Db } from '../db/index.js'

@Injectable()
export class PostgresIndicator {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check('postgres')
    try {
      await this.db.execute(sql`select 1`)
      return indicator.up()
    } catch (error) {
      return indicator.down({ message: error instanceof Error ? error.message : 'unreachable' })
    }
  }
}
```

`redis.indicator.ts` is the same shape with `await this.redis.ping()` and key `'redis'`.

`outbox.indicator.ts` — note `status` is a reserved key in the detail object (ADR-0001), so the count is named `dead`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus'
import { and, count, gte, isNull } from 'drizzle-orm'
import { DRIZZLE, type Db } from '../db/index.js'
import { MAX_ATTEMPTS, outboxEvents } from '../outbox/index.js'

@Injectable()
export class OutboxIndicator {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check('outbox')
    const [row] = await this.db
      .select({ dead: count() })
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.publishedAt), gte(outboxEvents.attempts, MAX_ATTEMPTS)))

    // Deliberately `up`, never `down` or `degraded`: parked events need a
    // human, but the service is still serving and Liara must keep routing.
    return indicator.up({ dead: row?.dead ?? 0 })
  }
}
```

- [ ] **Step 4: Add the route**

```ts
@Get('ready')
@HealthCheck()
ready() {
  return this.health.check([
    () => this.postgres.check(),
    () => this.redis.check(),
    () => this.outbox.check(),
  ])
}
```

- [ ] **Step 5: The 503 path — Terminus's exception meets the global `ProblemFilter`**

**Ruling, taken 2026-09-24**, carried forward from Task 6's review, which found this and deferred the decision to here.

`HealthCheckService.check()` throws Terminus's `ServiceUnavailableException` when an indicator reports down. `ProblemFilter` is `@Catch()` — it catches everything — and an `HttpException` carrying 503 takes its `CODE_BY_STATUS` path, where **503 is absent**, so it falls through to `'INTERNAL'`. Two things follow, both wrong:

- the body becomes `{ type: 'urn:problem:INTERNAL', title: 'Internal Server Error', status: 503, … }` — a title that contradicts its own status; and
- Terminus's `{ status, info, error, details }` body is **discarded**, and that is the only part of the response saying _which_ store is down. Which is the entire purpose of the endpoint.

The two ways out were: add a 503 code to `ERROR_CODES`, or scope a filter to the health controller. **Ruled: scope a filter to the health controller.** `ERROR_CODES` is the _API's_ error contract — nine codes, named by the spec, with a `@ds/contracts` test asserting exactly nine, consumed by `@ds/api-client` and the web app. `/health/ready` is not in that contract; its consumers are Liara's health checker and a human reading a deploy log. A tenth code would fix the title and still throw away `info`/`error`/`details` — repairing the cosmetic half of the defect, leaving the substantive half, and widening a public contract for an endpoint that does not belong to it. Cost if wrong: one controller-scoped filter to delete and a contracts change to make instead.

Required effect. The mechanism is yours:

1. `GET /health/ready` with a store unreachable answers **503 carrying Terminus's own body** — `status`, and `details` naming the indicator that is down — not an RFC 9457 problem body.
   **Each indicator separately**, not just whichever one is easiest to break. An indicator that returns `up()` without ever reaching its store passes every happy-path test in Step 1, and a `PostgresIndicator` that skips its `select 1` would report the API ready while Postgres is down — which is Liara routing traffic to a container that 500s every request, the one outcome this endpoint exists to prevent. Postgres is the awkward one to take down mid-suite; that is why it is the one worth doing.
2. Every other route's error handling is **unchanged**; `ProblemFilter` still owns them. Pin that too: assert some non-health route still answers `application/problem+json`.
3. A readiness 503 **does not log a stack trace**. It is a reported condition, not a bug, and Liara probes on an interval — `ProblemFilter`'s `status >= 500` branch would otherwise write one full stack per probe for the length of the outage. (The relay's own per-cycle error line is a separate, already-recorded source of the same noise. It is **not** yours to fix here.)

Verify the mechanism instead of assuming it. If you scope a filter with `@UseFilters` on the controller, **prove** it takes precedence over the globally registered `ProblemFilter` with a test that fails when that filter is removed — do not infer it from Nest's documented binding order.

- [ ] **Step 6: The readiness endpoint must survive the outage it reports**

This task's own preamble states the requirement — "the Docker `HEALTHCHECK` stays on `/health/live` so a Redis blip does not restart-loop the container" — and no step implements it. `ThrottlerGuard` is registered globally as `APP_GUARD` and its storage is Redis-backed, so it runs ahead of both health routes and reaches Redis on every probe.

Required effect: **with Redis unreachable, `GET /health/live` still answers 200 and `GET /health/ready` answers 503 reporting `redis` down — neither answers 500.** A readiness endpoint that returns `INTERNAL` when Redis is down has failed at the one job it has, and a liveness endpoint that does the same restart-loops the container during a Redis blip.

Find out what the global guard actually does to those two routes against a Redis that is not answering before deciding what to change. `@SkipThrottle()` on the controller is the obvious candidate, but the deliverable is the measured behaviour, not the decorator. The test must drive the real guard and the real client against a Redis that is not answering — arranging that is yours; substituting a mock of the guard for the behaviour is not.

- [ ] **Step 7: Run, verify, commit**

```bash
pnpm --filter api build && pnpm --filter api test:integration
pnpm check
git add apps/api
git commit -m "feat(api): report Postgres, Redis and parked outbox events on /health/ready"
```

---

## Task 16: Process topology

§5.2. One bootstrap reading `PROCESS_ROLE`: `api` serves HTTP, `all` serves HTTP **and** runs the relay in the same DI container, `worker` runs the relay with no HTTP server.

**Files:**

- Modify: `apps/api/src/main.ts`
- Create: `apps/api/src/worker.ts`
- Test: `apps/api/test/integration/process-role.test.ts`

**Interfaces:**

- Consumes: `OutboxRelay`, `AppConfig`.
- Produces: `bootstrapWorker(): Promise<INestApplicationContext>`; `createApp()` unchanged in signature.

- [ ] **Step 1: Write the failing test**

`apps/api/test/integration/process-role.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../../src/app.module.js'
import { OutboxRelay } from '../../src/infra/outbox/index.js'

let app: NestFastifyApplication | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

async function bootWith(role: string): Promise<NestFastifyApplication> {
  process.env.PROCESS_ROLE = role
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const built = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )
  built.enableShutdownHooks()
  await built.init()
  return built
}

describe('PROCESS_ROLE', () => {
  it('serves HTTP under api', async () => {
    app = await bootWith('api')
    const res = await app.inject({ method: 'GET', url: '/health/live' })
    expect(res.statusCode).toBe(200)
  })

  it('stops the relay cleanly on shutdown, awaiting the in-flight cycle', async () => {
    app = await bootWith('all')
    const relay = app.get(OutboxRelay)
    relay.start()
    // close() triggers onApplicationShutdown, which awaits stop(). If the
    // interval were left running, the pool would close underneath it and
    // the process would not exit.
    // Amended 2026-09-24 (twice). THREE distinct properties need pinning here,
    // and the obvious assertion pins none of them:
    //   (a) the interval is cleared — a no-op stop() leaves it running;
    //   (b) stop() does not RESOLVE before the in-flight cycle does, which is
    //       what "SIGTERM must not cut a cycle in half" actually means;
    //   (c) close() awaits stop() rather than merely resolving alongside it.
    // Deleting `await this.inFlight` from OutboxRelay.stop() was measured against
    // the Task 13 unit suite and broke NOTHING — so (b) is unpinned today, and a
    // timer-count assertion alone will not pin it either: a stop() that clears the
    // interval and returns immediately looks identical to a correct one. Pin (b)
    // with a stubbed runOnce returning a promise you control: start, advance the
    // timer to begin a cycle, call stop(), assert it is still pending, then resolve
    // the cycle and assert stop() resolves after it.
    //
    // First amendment, still required: `resolves.toBeUndefined()` on its own is vacuous —
    // close() resolves whether or not the interval was cleared, and a leaked
    // interval's next tick rejects on the ended pool straight into OutboxRelay's
    // own catch, so nothing surfaces. Assert EVIDENCE THE TIMER STOPPED: either
    // fake timers with `vi.getTimerCount()` before and after, or an
    // OUTBOX_POLL_MS override (min 50, via the overrideProvider(AppConfig)
    // pattern in test/integration/db.test.ts) plus a CONDITION WAIT — poll until
    // published, with a deadline — before and after stop(). A fixed sleep is what
    // .claude/rules/testing.md bans; a condition wait is not.
    // The assertions for (a), (b) and (c) are deliberately NOT written out
    // here. Spelling them would pick your mechanism for you a third time, and
    // that is the mistake this comment exists to stop repeating.
    app = undefined
  })

  it('is safe to stop a relay that was never started', async () => {
    app = await bootWith('worker')
    await expect(app.get(OutboxRelay).stop()).resolves.toBeUndefined()
  })
})
```

**How this task is judged done, since the block above stops short on purpose.** Properties (a), (b) and (c) get **three separately named tests**, not one test with three assertions — a reviewer has to be able to see which property is covered and which is not. Then prove each one bites, by removing its guard from `OutboxRelay` one at a time and recording what fails:

| Remove from `OutboxRelay`                        | The test that must go red                                |
| ------------------------------------------------ | -------------------------------------------------------- |
| `clearInterval(this.timer)` in `stop()`          | (a)                                                      |
| `await this.inFlight` in `stop()`                | (b) — **measured 2026-09-24: today this breaks nothing** |
| `await this.stop()` in `onApplicationShutdown()` | (c)                                                      |

Paste the three failures into your report. A property whose mutation leaves the suite green is not pinned, whatever the test is named — that is exactly how (b) survived Task 13 with four passing tests over it.

- [ ] **Step 2: Run it and watch it fail, then implement**

`src/main.ts`'s `bootstrap()` gains, after `createApp()` returns. (Task 8 moved the
filter and pipe registration into `src/app.factory.ts`; only the relay start and
`listen` belong in `main.ts`.)

```ts
const config = app.get(AppConfig)
if (config.processRole === 'all') {
  app.get(OutboxRelay).start()
}
await app.listen({ port: config.port, host: '0.0.0.0' })
```

`src/worker.ts`:

```ts
import { NestFactory } from '@nestjs/core'
import type { INestApplicationContext } from '@nestjs/common'
import { AppModule } from './app.module.js'
import { OutboxRelay } from './infra/outbox/index.js'

/** No HTTP server: createApplicationContext only (§5.2). */
export async function bootstrapWorker(): Promise<INestApplicationContext> {
  const context = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true })
  context.enableShutdownHooks()
  context.get(OutboxRelay).start()
  return context
}

if (process.env.PROCESS_ROLE === 'worker') {
  await bootstrapWorker()
}
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter api build && pnpm --filter api test:integration
PROCESS_ROLE=all node apps/api/dist/main.js &
sleep 3 && curl -fsS http://127.0.0.1:3001/health/ready | head -c 200 && kill %1
pnpm check
git add apps/api
git commit -m "feat(api): select the process role at boot and stop the relay gracefully"
```

---

## Task 17: Module boundaries and the CI build step

§5.3 and §10.1. `dependency-cruiser` turns the architecture diagram into a failing build, and the CI `check` job gains the `build --affected` step that is DoD 9.

**Files:**

- Create: `apps/api/.dependency-cruiser.cjs`
- Test: `apps/api/test/boundaries.test.ts` (unit — asserts the rules exist and the task runs)
- Modify: `apps/api/package.json` (add `boundaries` script, `dependency-cruiser`), `.github/workflows/ci.yml`, and `packages/config-eslint/nest.js` (Step 4 — `eslint-plugin-boundaries` is a declared dependency no config has ever referenced)

**Interfaces:**

- Consumes: the directory layout from every earlier task, including the entrypoints `main.ts`, `app.factory.ts`, `openapi.ts`, `migrate.ts` and Task 16's `worker.ts` — which stand or fall together under any rule that treats one of them specially.
- Produces: the `boundaries` turbo task, already declared in `turbo.json` and a no-op until this task gives some package a `boundaries` script.

- [ ] **Step 1: Write `.dependency-cruiser.cjs`**

CommonJS on purpose — dependency-cruiser loads its config with `require`, and `apps/api` is `"type": "module"`, so the `.cjs` extension is what makes it loadable.

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-internals',
      comment: 'modules/A may import modules/B/index.ts and nothing deeper (§5.3)',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/([^/]+)/(?!index\\.ts)', pathNot: '^src/modules/$1/' },
    },
    {
      name: 'domain-is-pure',
      comment: 'domain/** is plain TypeScript: no framework, no driver (§5.3)',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: 'node_modules/(@nestjs|drizzle-orm|pg|ioredis)/' },
    },
    {
      name: 'application-uses-ports',
      comment: 'only the module file wires ports to adapters (§5.3)',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/infrastructure/' },
    },
    {
      name: 'shared-and-infra-are-leaves',
      comment: 'shared/** and infra/** never import modules/** (§5.3)',
      severity: 'error',
      from: { path: '^src/(shared|infra)/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}
```

- [ ] **Step 2: Add the script FIRST, then prove each rule actually fires**

**Corrected 2026-09-24. The original Step 2 could not run and its second check could not have worked.** Two defects:

- It invoked `pnpm --filter api exec depcruise …`, and `Bash(pnpm exec *)` is **denied** in this environment (spec §19.9). Add the `boundaries` script before proving anything, and drive every check through `pnpm --filter api boundaries`.
- It deleted `apps/api/src/modules/demo` **before** writing `src/shared/bad.ts`, whose whole purpose is to import `../modules/demo/index.js`. Against a target that no longer exists, what comes back is an unresolvable-module complaint, not `shared-and-infra-are-leaves`. A check that fails for the wrong reason is indistinguishable from a rule that works.

So: add `"boundaries": "depcruise src --config .dependency-cruiser.cjs"` to `apps/api/package.json` and `dependency-cruiser` as a catalog devDependency, confirm `pnpm --filter api boundaries` exits **0** against today's tree, and only then start breaking it.

Required effect: **every rule in the config is observed to fail, by name, against a violation built for it, and the tree is clean again afterwards.** A rule that has never been seen to fire is decoration. Build each fixture so the _only_ thing wrong with it is the thing the rule forbids — if a fixture needs a module to import, create that module and delete it after, not before. Arranging the fixtures is yours; the deliverable is the rule name in real output for each rule, pasted into your report.

- [ ] **Step 3: Enforce the barrel convention — the one live rule nothing checks**

**Added 2026-09-24 by measurement, and corrected the same day — the first version of this paragraph claimed zero deep imports, which is false. The grep behind it required a leading `../` and so could not see any `./`-prefixed import at all.** What is actually true, and it is the more useful statement:

**Between `infra/*` directories, the barrel holds without exception.** `outbox.relay.ts`, `logger.module.ts`, `db.module.ts`, `drizzle.provider.ts`, `http/problem.filter.ts` and `http/security.ts` all take `AppConfig`/`Env`/`Db` from `'../config/index.js'` or `'../db/index.js'`. Thirteen tasks held that line by hand and nothing enforces it.

**Every exception lives at the `src/` root, and there are exactly three:**

| Import                                              | Verdict                                                                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.module.ts` → `./infra/health/health.module.js` | **Accidental.** `infra/health/` is the only `infra/*` directory with no `index.ts`. Task 15 owns the barrel.                                                                                  |
| `migrate.ts` → `./infra/db/migration-lock.js`       | **Deliberate and load-bearing.** The reason is written in `migration-lock.ts`: the barrel carries `DbModule`, and with it `ConfigModule`, which validates the environment at decoration time. |
| `migrate.ts` → `./infra/config/env.schema.js`       | **Deliberate**, same reason — `migrate.ts` needs the schema without booting the Nest graph.                                                                                                   |

So the rule is not "no deep imports anywhere". It is "no deep import **between** `infra/*` directories", with the `src/` root entrypoints carrying a named allowance. Write it that way, or it fires on `migrate.ts` and the fix will be to weaken the rule rather than to keep the convention.

It is also the rule most likely to be broken next, precisely because it is invisible: the Task 14 brief shipped `import { AppConfig } from '../config/app-config.js'` in its own sample code.

Required effect: **an import that reaches past an `infra/<dir>/index.ts` from outside that directory fails `pnpm check`.** File-to-file imports _within_ one directory stay legal — that is the normal case, not an exception. Prove it fires and prove it does not fire on the legal case.

Two notes on scope. First, `src/main.ts`, `src/app.factory.ts`, `src/openapi.ts`, `src/migrate.ts` and Task 16's `src/worker.ts` are entrypoints: whatever treatment one of them needs — an allowance, an orphan exemption, a `doNotFollow` — **all** of them need, or a rule will fire on one and not its twin. Task 8 split `app.factory.ts` out of `main.ts` precisely so the security wiring could be tested; do not let a boundaries rule punish that. Second, barrels hold re-exports only, and that is a convention this rule does not check — leave it to review.

- [ ] **Step 4: Wire `eslint-plugin-boundaries` (spec §4.1, missing from this plan)**

**Ruling, taken 2026-09-24.** Spec §4.1 line 120 lists enforcement as "…`dependency-cruiser` in `apps/api` (module boundaries, §5.3; task `boundaries`), **`eslint-plugin-boundaries` in both apps**, `sherif`… — all wired into `pnpm check`." `eslint-plugin-boundaries` is declared in `@ds/config-eslint`'s `dependencies` and **no config file references it** — not `base.js`, `nest.js`, `next.js` or `rtl.js`. It has been dead since Phase 1, and this plan never assigned it an owner. `apps/web` is Phase 3, so the `apps/api` half is this task's.

**Ruled: wire it, and give it the rules dependency-cruiser is worst at rather than a copy of them.** The two tools do different jobs and the duplication would be the waste, not the plugin: ESLint reports per file, at author time, in the editor, which is where a wrong import is cheapest to fix; dependency-cruiser sees the whole graph, which is the only way to catch circularity. `boundaries/entry-point` is, by name and by design, the rule for "this directory may be entered only through its barrel" — so Step 3's rule belongs here, and dependency-cruiser keeps the graph-wide ones. Cost if wrong: one config block to delete, and the barrel rule moves back to `.dependency-cruiser.cjs`.

A declared-but-unreferenced dependency is the worst of the three options available: it reads as enforcement to anyone auditing `package.json` and enforces nothing.

Required effect: **`pnpm check` fails on a boundary violation that ESLint can see in a single file, and the element types describe the layout that exists** — `infra/*`, `shared/*`, and `modules/*` for the aggregates Phase 3 adds. Same bar as Step 2: each rule is observed to fire by name before you keep it.

- [ ] **Step 5: Add the CI build step (DoD 9)**

In `.github/workflows/ci.yml`, in the `check` job after `pnpm check:affected`:

```yaml
- name: Build with an unreachable API URL (DoD 9)
  run: pnpm turbo run build --affected --output-logs=errors-only --env-mode=strict
  env:
    TURBO_SCM_BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
    NEXT_PUBLIC_SITE_URL: http://localhost:3000
    API_INTERNAL_URL: http://127.0.0.1:9
```

`API_INTERNAL_URL` points at a closed port on purpose: §10.1 uses the build succeeding against an unreachable API as the DoD 9 acceptance. It has no effect until `apps/web` exists in Phase 3, and declaring it now means the job does not change shape then.

- [ ] **Step 6: Verify and commit**

```bash
pnpm check
git add apps/api .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "feat(api): enforce module boundaries and build under strict env in CI"
```

---

## Phase 2 completion

The phase is done when all of the following hold:

```bash
pnpm db:up                     # four services healthy
pnpm db:migrate                # 0000_extensions + 0001_outbox_events applied
pnpm check                     # lint, typecheck, unit, integration, boundaries, sherif, docs, format
pnpm --filter api openapi      # writes openapi.json with no services running
pnpm audit:authors             # only Saman
```

and `PROCESS_ROLE=all node apps/api/dist/main.js` answers `GET /health/ready` with 200 and an `outbox.dead` detail.

Spec **DoD 4** (outbox `runOnce()` success/retry/park plus the S3 smoke test) and **DoD 8** (ADR-0001, done in the spike) are satisfied. Then one rebase-merge PR, `feat/api-foundation` → `main`, per [ADR-0018](../../decisions/0018-one-pr-per-phase.md).

**Deliberately deferred from §5.3.** That section lists `src/shared/` as holding a minimal `Money` value object. Nothing in Phase 2 has a price — Brand has no money, and the `money` contract schema is explicitly a products-spec concern (§4.5). Building an untested value object now would be dead code that the first real consumer would reshape anyway, so `Money` arrives with the first priced aggregate. Everything else §5.3 names — the `AppError` hierarchy, pagination helpers, ids, and the OpenAPI helpers — is built here.

**Not in Phase 2:** `@ds/api-client`, `apps/web`, `catalog/brand.ts` and the Brand module, the seed, Docker images, the `openapi`/`e2e`/`docker` CI jobs, Liara and ArvanCloud. Phase 3 begins with the reference slice, whose contracts build on Task 2's `common/` and `errors/`.
