# Dubai Supplement — The Brand Slice Through the API (Phase 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the catalog context's first aggregate end to end on the API side — the Brand contract, the Nest `catalog` module with its migration, seed and outbox event, the typed `@ds/api-client` the storefront calls, and the CI job that keeps `openapi.json` and the generated client fresh — so 3c can render brands on real data.

**Architecture:** Contracts first (Zod shapes that become the OpenAPI document), then the module in dependency order — `domain/` (the `Brand` entity that normalises Persian on write, and its `catalog.brand.created` event), `application/` (the `BrandRepository` port, `BrandService`, the logging handler), `infrastructure/` (the `brands` table with its generated `search_text` column, the migration, the Drizzle repository), `api/` (two read-only routes) — wired in `catalog.module.ts` and registered in `app.module.ts`. `BrandService.create` writes the row and the outbox row in one `db.transaction`. The seed goes through the service and is idempotent by slug. `@ds/api-client` wraps openapi-fetch over types generated from `openapi.json` and turns `problem+json` into `ApiError`. `pnpm openapi:generate` is the one pipeline (build the API → write `openapi.json` → generate `schema.d.ts`), run locally and by the new `openapi` CI job.

**Tech Stack:** NestJS 12.0.4 ESM on Fastify (`@nestjs/swagger` 12.0.1) · Zod 4.6.5 · Drizzle ORM 0.45.3 + drizzle-kit 0.31.11 · pg 8.23.0 · PostgreSQL 16 (ICU `fa` collation, `pg_trgm`) · `uuid` 14.0.2 (v7) · `@ds/persian` · openapi-typescript 7.13.0 · openapi-fetch 0.17.0 · `server-only` 0.0.1 · Vitest 5.0.1 · Testcontainers 12.1.0

**Spec:** `docs/superpowers/specs/2026-08-27-foundation-design.md` — §5.3 (module anatomy), §5.6 (outbox), **§5.7 (the reference slice)**, §6.3 (schema conventions, the Persian-text row), §6.4 (transactions), §7.4 (data access boundary), **§8.1–§8.2 (contracts and the client)**, §10.1 (the `openapi` job), §12.1 (the `CLAUDE.md` files), **§14 (end-to-end flow)**; `docs/superpowers/specs/2026-09-25-storefront-design-system-design.md` §1 (the 3a/3b/3c split, D8). The brainstorm that scoped this plan is recorded in Saman's plan file of 2026-09-25 (`brainstorm-3b-with-the-composed-wolf.md`).

**Starting state:** branch `feat/brand-slice` at `aaeb5b7` (= `origin/main` on 2026-09-25: Phases 1–2, 3a (PR #8), the Lapis palette (PR #9) and the frontend-engineer skill (PR #10) all merged). `apps/api/src/modules/` and `packages/api-client/` do not exist. `apps/api/openapi.json` holds only `/health/live` and `/health/ready` with empty `components.schemas`. `ERROR_CODES` already holds `CATALOG_BRAND_NOT_FOUND` and `CATALOG_BRAND_SLUG_TAKEN`, and `TITLE_BY_CODE` has their titles. The catalog already pins `openapi-typescript 7.13.0`, `openapi-fetch 0.17.0` and `server-only 0.0.1`; `turbo.json` already declares `@ds/api-client#generate` (depends on `api#openapi`) and the root script `openapi:generate` already runs it. `apps/api` does **not** depend on `@ds/persian` and nothing depends on `uuid`.

## Global Constraints

Copied from the spec and the rules files. Every task's requirements implicitly include this section.

- **Human-only authorship.** Every commit is authored by Saman Hoseinpour. No `Co-Authored-By`, no "Generated with", no bot attribution (foundation §13.4; `scripts/check-commit-msg.sh`, `audit:authors`). The `no-ai-trailers` hook also blocks any Bash command whose text contains those trailer patterns — so an executor never pastes them into a heredoc; a file that must quote them (this one) is written with the Write tool.
- **Never read an env file.** `.env*` is Read-denied for the agent — `apps/api/.env.example` included. 3b adds no environment variable, so no step needs to open one. The `openapi` CI job copies `.env.example` to `.env` without reading it.
- **Exact pins only, in the catalog.** `catalogMode: strict`, `minimumReleaseAge: 1440`. The one new pin is `uuid: 14.0.2` (published 2026-08-18; verified on npm 2026-09-25). Never run `sherif -f`. A 403 from the registry means the VPN: stop and ask.
- **ESM.** Relative imports carry `.js`; paths come from `import.meta.url`; never `__dirname`, never `require`.
- **Contracts are Zod only** (spec §5.5, `api.md`): `@Query({ schema })`, `@Param(name, { schema })`, `@ApiZodResponse(status, schema)`; no DTO classes, no `class-validator`, no `@ApiProperty`. Zod 4 top-level forms; `z.iso.datetime()` **requires seconds**; `.max()` counts code points (`contracts.md`).
- **Contracts describe HTTP shapes, never domain entities.** `apps/web` never imports the API's domain; `@ds/api-client → @ds/contracts` is a types-only edge (north-star §2 rule 2).
- **The API speaks English.** Every `detail` string is English. The seed's Persian brand names and descriptions are data, not copy.
- **Persian text is normalised on write, in the domain entity** (`persian.md`): `normalizePersian` trims, turns Arabic ي/ك into Persian ی/ک and Persian/Arabic digits into ASCII. **ZWNJ (U+200C) is meaningful**: storage keeps it; only the `search_text` column turns it into a space.
- **Module anatomy is not negotiable** (§5.3, `dependency-cruiser`, `eslint-plugin-boundaries`): `modules/catalog/index.ts` is the only path another module or an entrypoint may import; `domain/**` imports no `@nestjs/*`, `drizzle-orm`, `pg`, `ioredis` and no sibling layer; `application/**` never imports `infrastructure/**`; only `catalog.module.ts` wires ports to adapters; `shared/**` and `infra/**` never import `modules/**`; every `infra/*` and `shared/*` import goes through that directory's `index.ts` (the `infra-barrel` and `shared-barrel` lint policies).
- **Database** (`db.md`): camelCase keys, `casing: 'snake_case'`; `drizzle-kit generate` then commit the SQL — never `push`; UUIDv7 primary keys minted in application code; `timestamptz`; `updatedAt` set by application code; invariants are constraints (`UNIQUE`, `CHECK`).
- **No store is touched while `AppModule` boots.** `test/integration/openapi.test.ts` boots the app with every store on a closed port and asserts `PG_POOL.totalCount === 0` and that the document equals the committed `openapi.json`. A repository that queries in `onModuleInit`, or a route added without regenerating, fails `pnpm check`.
- **Generated files are never hand-edited** (`generated.md`): `apps/api/openapi.json` and `packages/api-client/src/generated/**` come only from `pnpm openapi:generate`. Both are in `.prettierignore` already.
- **Logging:** one object per line through Nest's `Logger` — `this.logger.log({ msg: '…', slug })` — never a string first with an Error after it (nestjs-pino drops it).
- **Tests** (`testing.md`): no production code without a failing test you watched fail; unit tests colocated as `src/**/*.test.ts` (no store; the vitest env supplies closed ports); integration tests as `test/integration/<topic>.test.ts` on Testcontainers through `withDb()`, isolation by truncation (`fixture.reset()`), outbox tests call `runOnce()`; Vitest 5 `clearMocks: true`.
- **`turbo.json` is strict JSON** (no comments — `test/boundaries.test.ts` parses it); `boundaries.test.ts` pins the dependency-cruiser rule names and the ESLint policy names exactly, so this plan adds none.
- **Commit scopes** `api`, `contracts`, `api-client`, `deps`, `ci`, `docs`, `config`; conventional commits; **every task ends with `pnpm check` green.**

## Review Focus

Five failure modes the spec implies but no happy path exercises. Each has a test pinned to the task that owns the code.

1. **A slug with uppercase or an underscore reaches the API** — `GET /catalog/brands/MuscleTech`. It must be a `400 VALIDATION_FAILED` whose `errors[0].path` is `slug`, never a 404: a 404 would claim the brand does not exist, and it may. Task 7.
2. **`?page=99` past the last page.** `200` with `items: []` and the true `total`, never a 404, never a clamp to the last page. Task 7.
3. **A crashed seed left three of nine rows.** The next `pnpm db:seed` inserts only the missing six and emits exactly six more `catalog.brand.created` rows — no row twice, no event twice, and `runOnce()` delivers every event to the logging handler. Task 8.
4. **Arabic-script input on the write path.** A name typed with Arabic yeh/kaf or Persian digits is stored in normalised form, and a name with a ZWNJ keeps it. Task 3 (the entity) and Task 5 (`name` keeps U+200C in the row; `search_text` is the space form).
5. **Two brands whose names differ only by ZWNJ** («ماسل تک» and «ماسل‌تک») are two rows with one `search_text` — allowed, because uniqueness is on the slug — listed deterministically by the `id` tie-break. Task 5.

## Deviations and judgement calls — read first, veto any

1. **`BrandCreated` is a domain-owned type**, structurally compatible with `DomainEvent` (`infra/outbox`), so `domain/` imports nothing from `infra/`. `EventPublisher.publish` accepts it because the shapes agree; a drift fails typecheck in `BrandService`.
2. **The unique-violation → `ConflictError` mapping lives in the repository**, which is the layer that knows pg error `23505` and the constraint name. The service stays driver-free.
3. **Slug and name invariants are also `CHECK` constraints** (`db.md`: invariants are constraints, not just code).
4. **`@ds/api-client` has no React dependency.** Foundation §8.2 says `publicApi` is "`React.cache`-deduped"; a package that imports `react` would be a second React instance under pnpm's isolation, and `'use cache'` functions are already memoised per request by Next. `publicApi` is a lazy singleton `Proxy` over one client; if 3c measures duplicate fetches inside one render, `cache()` goes into `apps/web/lib/catalog.ts`, where React lives.
5. **`publicApi` reads `API_INTERNAL_URL` itself, on first use, never at import.** A package cannot import `apps/web/lib/env.ts`; the 3a comment that `getServerEnv()` gains `publicApi` as its caller is therefore corrected by 3c (which decides whether `lib/env.ts` stays for `requestApi()` or goes).
6. **The seed fixtures carry a one-line Persian `description` each** — the body of 3c's brand tile — within `persianText(2000)`. The foundation seed listed names only. Saman edits the sentences in the spec review or in the fixture file; each is a fact about the brand, not a promise about the store.
7. **This plan is committed on `feat/brand-slice`** as its first commit, as the 3a plan was on `feat/web-foundation`, rather than on a separate docs branch.
8. **`BrandCreatedLogger`** — the "logging handler" foundation §14 step 5 names — lives in `application/` as a provider of `CatalogModule`, so `OutboxRelay`'s discovery scan finds it.
9. **`BrandService.findBySlug` exists beside `getBySlug`.** The seed needs "does it exist" as `null`, the controller needs the 404; one throwing method would force the seed to catch a `NotFoundError` as control flow.
10. **Schemas carry `.meta({ id })`** (`Brand`, `BrandListResponse`) so the document and the generated client can name them. If `@nestjs/swagger` renders them as JSON-Schema `$defs` instead of `components.schemas` (checked in Task 7, Step 8), the ids are removed and the task report says so — nothing else depends on them.
11. **The seed is the store's nine real brands**, read from the labels in Saman's four shelf photographs of 2026-09-25 (his instruction: the photographs never ship), not foundation §5.7's six examples — which stay as test data in every suite of Tasks 1–7. Every spelling but «بلک اسکال» (his) is a transliteration he corrects in `seed-brands.ts`: data, not a migration. Task 8 amends foundation §5.7, §7.9 and §14 in its commit; the 3c spec's D29 records what follows for the storefront.
12. **The generated client schema is `src/generated/schema.ts`, not `schema.d.ts`** (ruled during Task 6): `tsc` does not emit `.d.ts` inputs, so the built package lost its path types. Every later mention of `schema.d.ts` in this plan means `schema.ts`.

---

## File Structure

| Path                                                                                                                                                                                                                                               | Responsibility                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/contracts/src/catalog/brand.ts`, `brand.test.ts`, `src/index.ts`                                                                                                                                                                         | the Brand HTTP shapes (Task 1)                                       |
| `pnpm-workspace.yaml`, `apps/api/package.json`, `apps/api/src/shared/ids/index.ts`, `ids.test.ts`                                                                                                                                                  | `uuid` and `@ds/persian` for the API; `newId()` (Task 2)             |
| `apps/api/src/modules/catalog/domain/brand.ts`, `brand.test.ts`, `events.ts`                                                                                                                                                                       | the aggregate and its event — pure TypeScript (Task 3)               |
| `apps/api/src/modules/catalog/application/brand.repository.ts`, `brand.service.ts`, `brand.service.test.ts`, `brand-created.logger.ts`, `brand-created.logger.test.ts`                                                                             | the port, the use cases, the handler (Task 4)                        |
| `apps/api/src/modules/catalog/infrastructure/schema.ts`, `brand.repository.ts`, `apps/api/drizzle/0002_brands.sql` (+ `meta/`), `apps/api/test/integration/catalog-brands.test.ts`                                                                 | the table, the migration, the adapter (Task 5)                       |
| `packages/api-client/**` (package, configs, `src/index.ts`, `errors.ts`, `server.ts`, tests, `src/generated/schema.d.ts`), `scripts/check-docs.manifest`                                                                                           | the typed client (Task 6)                                            |
| `apps/api/src/modules/catalog/api/brands.controller.ts`, `catalog.module.ts`, `index.ts`, `apps/api/src/app.module.ts`, `apps/api/test/integration/catalog-http.test.ts`, `apps/api/openapi.json`, `packages/api-client/src/generated/schema.d.ts` | the routes, the wiring, the regenerated document and client (Task 7) |
| `apps/api/src/modules/catalog/application/seed-brands.ts`, `apps/api/src/seed.ts`, `apps/api/test/integration/seed.test.ts`, `apps/api/package.json`, `turbo.json`, root `package.json`                                                            | the seed and its three scripts (Task 8)                              |
| `.github/workflows/ci.yml`, `apps/api/CLAUDE.md`, `packages/contracts/CLAUDE.md`, `scripts/check-docs.manifest`, `README.md`, `.claude/skills/new-api-module/SKILL.md`, both specs' status rows                                                    | the `openapi` job and the documents the spec owes (Task 9)           |

**Model routing (Saman, 2026-09-25):** Fable 5.1 for Tasks 1, 3, 4, 5, 6, 7; Opus 5.5 for Tasks 2, 8, 9, 10. Quality over tokens — when in doubt, Fable.

**Commands and permissions.** `pnpm install` (bare), `pnpm check*`, `pnpm lint*`, `pnpm typecheck*`, `pnpm test*`, `pnpm build*`, `pnpm boundaries*`, `pnpm db:*`, `pnpm openapi:generate*`, `pnpm format*`, `pnpm audit:authors*`, `git status/diff/log/add/commit`, `gh pr view/create` are pre-approved. `pnpm --filter …`, `pnpm add …`, `pnpm dlx …` and `git push` ask — so add a dependency by editing `package.json` and running `pnpm install`, and run one package through turbo's forwarded filter: `pnpm test --filter=api`, `pnpm test:integration --filter=api`, `pnpm build --filter=api`, `pnpm lint --filter=@ds/api-client`. `pnpm exec`, `curl` and `wget` are denied: hit a running server with `node -e "fetch(…)"`. Integration tests need Docker (OrbStack) running; from Iran, image pulls need the VPN (`docs/runbooks/iran-mirrors.md`).

---

## Task 1: Contracts — `packages/contracts/src/catalog/brand.ts`

Spec §8.1 (`src/catalog/brand.ts`), `contracts.md`. The wire shapes the API documents and the client types; nothing here is a domain entity.

**Files:**

- Create: `packages/contracts/src/catalog/brand.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/catalog/brand.test.ts`

**Interfaces:**

- Consumes: `id`, `slug`, `persianText`, `PageQuerySchema`, `paginated` from `../common/index.js`.
- Produces: `BrandSchema` (`.meta({ id: 'Brand' })`), `type Brand = { id: string; slug: string; name: string; description?: string; createdAt: string; updatedAt: string }`; `BrandListQuerySchema` (= `PageQuerySchema`), `type BrandListQuery = { page: number; pageSize: number }`; `BrandListResponseSchema` (`paginated(BrandSchema)`, `.meta({ id: 'BrandListResponse' })`), `type BrandListResponse = { items: Brand[]; page: number; pageSize: number; total: number }` — all re-exported from `@ds/contracts`.

- [ ] **Step 1: Write the failing test**

`packages/contracts/src/catalog/brand.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BrandListQuerySchema, BrandListResponseSchema, BrandSchema } from './brand.js'

const A_BRAND = {
  id: '0199f3c0-1111-7000-8000-000000000000',
  slug: 'muscletech',
  name: 'ماسل‌تک',
  createdAt: '2026-09-25T12:00:00.000Z',
  updatedAt: '2026-09-25T12:00:00.000Z',
}

describe('BrandSchema', () => {
  it('accepts the wire shape and keeps the ZWNJ in the name', () => {
    const parsed = BrandSchema.parse(A_BRAND)
    expect(parsed.name).toBe('ماسل‌تک')
    expect(parsed.name).toContain('‌')
    expect(parsed.description).toBeUndefined()
  })

  it('normalises Arabic letters in the name through persianText', () => {
    expect(BrandSchema.parse({ ...A_BRAND, name: 'يك' }).name).toBe('یک')
  })

  it('rejects a slug that is not lowercase Latin', () => {
    expect(() => BrandSchema.parse({ ...A_BRAND, slug: 'MuscleTech' })).toThrow()
    expect(() => BrandSchema.parse({ ...A_BRAND, slug: 'ماسل' })).toThrow()
  })

  // Zod 4.6: z.iso.datetime() requires seconds (contracts.md). The API emits
  // Date#toISOString(), which always carries them; this pins the contract so a
  // hand-built timestamp without seconds fails here, not as a 400 in production.
  it('requires seconds in the timestamps', () => {
    expect(() => BrandSchema.parse({ ...A_BRAND, createdAt: '2026-09-25T12:00Z' })).toThrow()
    expect(BrandSchema.parse({ ...A_BRAND, createdAt: new Date(0).toISOString() }).createdAt).toBe(
      '1970-01-01T00:00:00.000Z',
    )
  })

  it('caps the name at 200 and the description at 2000 code points', () => {
    expect(() => BrandSchema.parse({ ...A_BRAND, name: 'آ'.repeat(201) })).toThrow()
    expect(BrandSchema.parse({ ...A_BRAND, name: 'آ'.repeat(200) }).name).toHaveLength(200)
    expect(() => BrandSchema.parse({ ...A_BRAND, description: 'آ'.repeat(2001) })).toThrow()
    expect(
      BrandSchema.parse({ ...A_BRAND, description: 'آ'.repeat(2000) }).description,
    ).toHaveLength(2000)
  })

  it('names itself and the list envelope for the OpenAPI document', () => {
    expect(BrandSchema.meta()?.id).toBe('Brand')
    expect(BrandListResponseSchema.meta()?.id).toBe('BrandListResponse')
  })
})

describe('BrandListQuerySchema and BrandListResponseSchema', () => {
  it('is the page query, defaults included', () => {
    expect(BrandListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(() => BrandListQuerySchema.parse({ pageSize: '101' })).toThrow()
  })

  it('wraps brands in the page envelope', () => {
    const value = { items: [A_BRAND], page: 1, pageSize: 20, total: 1 }
    expect(BrandListResponseSchema.parse(value)).toEqual(value)
    expect(() =>
      BrandListResponseSchema.parse({ ...value, items: [{ ...A_BRAND, slug: 'X' }] }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=@ds/contracts`
Expected: FAIL — `Cannot find module './brand.js'`.

- [ ] **Step 3: Write the schemas**

`packages/contracts/src/catalog/brand.ts`:

```ts
import { z } from 'zod'
import { id, PageQuerySchema, paginated, persianText, slug } from '../common/index.js'

/**
 * The HTTP shape of a brand (foundation §8.1) — never the domain entity.
 * `createdAt` and `updatedAt` are full ISO-8601 with seconds, which Zod 4.6
 * requires and `brand.test.ts` pins. `.meta({ id })` names the schema so the
 * OpenAPI document and the generated client can carry `Brand` as a type.
 */
export const BrandSchema = z
  .object({
    id,
    slug,
    name: persianText(200),
    description: persianText(2000).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Brand' })

export type Brand = z.infer<typeof BrandSchema>

export const BrandListQuerySchema = PageQuerySchema
export type BrandListQuery = z.infer<typeof BrandListQuerySchema>

export const BrandListResponseSchema = paginated(BrandSchema).meta({ id: 'BrandListResponse' })
export type BrandListResponse = z.infer<typeof BrandListResponseSchema>
```

`packages/contracts/src/index.ts` — append:

```ts
export * from './catalog/brand.js'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --filter=@ds/contracts`
Expected: PASS, nine tests.

- [ ] **Step 5: Verify and commit**

Run: `pnpm check`
Expected: green (`apps/api`'s `openapi.json` is unchanged — no route uses the schemas yet).

```bash
git add packages/contracts/src/catalog/brand.ts packages/contracts/src/catalog/brand.test.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add the Brand HTTP shapes"
```

---

## Task 2: Dependencies and the id — `uuid`, `@ds/persian` in the API, `newId()`

ADR-0004 (UUIDv7 minted in application code; PostgreSQL 16 has no `uuidv7()`), `db.md`, the Phase 2 completion note ("`newId()` returns with the first aggregate that needs one, behind a barrel"), `persian.md` (the entity normalises with `normalizePersian`).

**Files:**

- Modify: `pnpm-workspace.yaml` (catalog), `apps/api/package.json`
- Create: `apps/api/src/shared/ids/index.ts`
- Test: `apps/api/src/shared/ids/ids.test.ts`

**Interfaces:**

- Consumes: `uuid` 14.0.2 (`v7`).
- Produces: `newId(): string` — a UUIDv7 — from the barrel `src/shared/ids/index.js`; `@ds/persian` resolvable from `apps/api`.

- [ ] **Step 1: Pin and declare**

In `pnpm-workspace.yaml`, append to `catalog:`:

```yaml
uuid: 14.0.2
```

In `apps/api/package.json`, add to `dependencies`, keeping the alphabetical order:

```json
    "@ds/persian": "workspace:*",
```

(after `"@ds/contracts": "workspace:*"`) and

```json
    "uuid": "catalog:",
```

(after `"rxjs": "catalog:"`, before `"zod": "catalog:"`).

Run: `pnpm install`
Expected: the lockfile gains `uuid@14.0.2` and the workspace link. A 403 means the VPN — stop and ask.

- [ ] **Step 2: Write the failing test**

`apps/api/src/shared/ids/ids.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { newId } from './index.js'

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('returns a version 7 UUID', () => {
    expect(newId()).toMatch(V7)
  })

  // uuid ≥ 11 keeps v7 ids monotonic inside one millisecond, which is what
  // makes a primary-key index over them append-mostly (ADR-0004).
  it('never repeats and sorts in generation order', () => {
    const ids = Array.from({ length: 200 }, () => newId())
    expect(new Set(ids).size).toBe(200)
    expect([...ids].sort()).toEqual(ids)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test --filter=api`
Expected: FAIL — `Cannot find module './index.js'`.

- [ ] **Step 4: Write the barrel**

`apps/api/src/shared/ids/index.ts`:

```ts
import { v7 as uuidv7 } from 'uuid'

/**
 * UUIDv7 for every primary key (ADR-0004): time-ordered, so an index over ids
 * stays append-mostly, and minted here because PostgreSQL 16 has no
 * uuidv7(). This is the whole of shared/ids on purpose — it is a barrel so
 * the `shared-barrel` policy applies to it like every other shared directory.
 */
export function newId(): string {
  return uuidv7()
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test --filter=api`
Expected: PASS.

- [ ] **Step 6: Verify and commit**

Run: `pnpm check`
Expected: green — `sherif` accepts the new pin, `boundaries` sees no new rule.

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml apps/api/package.json
git commit -m "chore(deps): pin uuid 14.0.2 and give the api @ds/persian"
git add apps/api/src/shared/ids/index.ts apps/api/src/shared/ids/ids.test.ts
git commit -m "feat(api): add newId behind shared/ids for the first aggregate"
```

---

## Task 3: Domain — the `Brand` aggregate and its event

Spec §5.7 (Domain), §6.3 (Persian text normalised on write), `persian.md`. Pure TypeScript: no `@nestjs/*`, no `drizzle-orm`, no sibling layer (the `domain-is-pure` and `domain-has-no-sibling-layers` rules). Deviation 1.

**Files:**

- Create: `apps/api/src/modules/catalog/domain/brand.ts`, `apps/api/src/modules/catalog/domain/events.ts`
- Test: `apps/api/src/modules/catalog/domain/brand.test.ts`

**Interfaces:**

- Consumes: `normalizePersian` from `@ds/persian`; `newId` from `../../../shared/ids/index.js`.
- Produces: `class Brand` with `static create(input: CreateBrandInput, now?: Date): Brand`, `static rehydrate(props: BrandProps): Brand`, readonly getters `id slug name description createdAt updatedAt`; `type CreateBrandInput = { slug: string; name: string; description?: string }`; `type BrandProps = { id: string; slug: string; name: string; description: string | undefined; createdAt: Date; updatedAt: Date }`; `class InvalidBrandError extends Error`; `const BRAND_CREATED = 'catalog.brand.created'`; `type BrandCreated` and `brandCreated(brand: Brand, occurredAt?: Date): BrandCreated`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/modules/catalog/domain/brand.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Brand, InvalidBrandError } from './brand.js'
import { BRAND_CREATED, brandCreated } from './events.js'

const NOW = new Date('2026-09-25T12:00:00.000Z')

describe('Brand.create', () => {
  // Review Focus 4: normalised on write, ZWNJ kept.
  it('normalises the name on write and keeps a ZWNJ', () => {
    const brand = Brand.create({ slug: 'muscletech', name: '  ماسل‌تك  ' }, NOW)
    expect(brand.name).toBe('ماسل‌تک')
    expect(brand.name).toContain('‌')
  })

  it('normalises the description too, digits included', () => {
    const brand = Brand.create(
      { slug: 'dymatize', name: 'دایماتایز', description: ' آیزو ۱۰۰ ' },
      NOW,
    )
    expect(brand.description).toBe('آیزو 100')
  })

  it('leaves the description undefined when none is given', () => {
    expect(Brand.create({ slug: 'bsn', name: 'بی‌اس‌ان' }, NOW).description).toBeUndefined()
  })

  it('mints a version 7 id and stamps both timestamps with the same instant', () => {
    const brand = Brand.create({ slug: 'bsn', name: 'بی‌اس‌ان' }, NOW)
    expect(brand.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(brand.id[14]).toBe('7')
    expect(brand.createdAt).toEqual(NOW)
    expect(brand.updatedAt).toEqual(NOW)
  })

  it.each(['MuscleTech', 'muscle_tech', 'ماسل', '', 'a'.repeat(65)])(
    'rejects the slug %j',
    (slug) => {
      expect(() => Brand.create({ slug, name: 'نام' }, NOW)).toThrow(InvalidBrandError)
    },
  )

  it('rejects a name that is empty after normalisation or over 200 code points', () => {
    expect(() => Brand.create({ slug: 'x', name: '   ' }, NOW)).toThrow(InvalidBrandError)
    expect(() => Brand.create({ slug: 'x', name: 'آ'.repeat(201) }, NOW)).toThrow(InvalidBrandError)
    expect(Brand.create({ slug: 'x', name: 'آ'.repeat(200) }, NOW).name).toHaveLength(200)
  })

  it('rejects a description that is blank or over 2000 code points', () => {
    expect(() => Brand.create({ slug: 'x', name: 'نام', description: '  ' }, NOW)).toThrow(
      InvalidBrandError,
    )
    expect(() =>
      Brand.create({ slug: 'x', name: 'نام', description: 'آ'.repeat(2001) }, NOW),
    ).toThrow(InvalidBrandError)
  })
})

describe('Brand.rehydrate', () => {
  it('wraps a stored row without normalising again', () => {
    const props = {
      id: '0199f3c0-1111-7000-8000-000000000000',
      slug: 'nutrex',
      name: 'نوترکس',
      description: undefined,
      createdAt: NOW,
      updatedAt: NOW,
    }
    const brand = Brand.rehydrate(props)
    expect(brand.id).toBe(props.id)
    expect(brand.name).toBe('نوترکس')
  })
})

describe('brandCreated', () => {
  it('describes the aggregate for the outbox', () => {
    const brand = Brand.create({ slug: 'nutrex', name: 'نوترکس' }, NOW)
    expect(brandCreated(brand)).toEqual({
      type: BRAND_CREATED,
      aggregateType: 'Brand',
      aggregateId: brand.id,
      payload: { id: brand.id, slug: 'nutrex', name: 'نوترکس' },
      occurredAt: NOW,
    })
    expect(BRAND_CREATED).toBe('catalog.brand.created')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=api`
Expected: FAIL — `Cannot find module './brand.js'`.

- [ ] **Step 3: Write the entity and the event**

`apps/api/src/modules/catalog/domain/brand.ts`:

```ts
import { normalizePersian } from '@ds/persian'
import { newId } from '../../../shared/ids/index.js'

export const SLUG_PATTERN = /^[a-z0-9-]+$/u
export const SLUG_MAX = 64
export const NAME_MAX = 200
export const DESCRIPTION_MAX = 2000

export type BrandProps = {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly description: string | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type CreateBrandInput = {
  readonly slug: string
  readonly name: string
  readonly description?: string
}

/**
 * An input that violates a Brand invariant. Only the seed and tests can
 * raise it — there is no write route (§5.7) — so it is a plain Error, not an
 * AppError with a wire code.
 */
export class InvalidBrandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidBrandError'
  }
}

/**
 * The aggregate (foundation §5.7). Persian text is normalised here, on write
 * (persian.md): trimmed, Arabic ي/ك turned into ی/ک, digits into ASCII — and
 * a ZWNJ inside a word survives, because normalizePersian never touches U+200C.
 * Limits count code points, like the contract does, so a ZWNJ costs one.
 */
export class Brand {
  private constructor(private readonly props: BrandProps) {}

  static create(input: CreateBrandInput, now: Date = new Date()): Brand {
    const { slug } = input
    if (!SLUG_PATTERN.test(slug) || slug.length > SLUG_MAX) {
      throw new InvalidBrandError(
        `slug must be lowercase Latin letters, digits and hyphens, at most ${SLUG_MAX} characters`,
      )
    }
    const name = normalizePersian(input.name)
    if (!withinLimit(name, NAME_MAX)) {
      throw new InvalidBrandError(`name must be 1 to ${NAME_MAX} code points after normalisation`)
    }
    const description =
      input.description === undefined ? undefined : normalizePersian(input.description)
    if (description !== undefined && !withinLimit(description, DESCRIPTION_MAX)) {
      throw new InvalidBrandError(
        `description must be 1 to ${DESCRIPTION_MAX} code points after normalisation`,
      )
    }
    return new Brand({ id: newId(), slug, name, description, createdAt: now, updatedAt: now })
  }

  /** A row read back: normalised when it was written, so nothing runs again. */
  static rehydrate(props: BrandProps): Brand {
    return new Brand(props)
  }

  get id(): string {
    return this.props.id
  }
  get slug(): string {
    return this.props.slug
  }
  get name(): string {
    return this.props.name
  }
  get description(): string | undefined {
    return this.props.description
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }
}

function withinLimit(text: string, max: number): boolean {
  const length = [...text].length
  return length >= 1 && length <= max
}
```

`apps/api/src/modules/catalog/domain/events.ts`:

```ts
import type { Brand } from './brand.js'

export const BRAND_CREATED = 'catalog.brand.created' as const

/**
 * Structurally a `DomainEvent` (infra/outbox), declared here so the domain
 * owns its events without importing infrastructure (plan deviation 1).
 * `EventPublisher.publish` accepts it because the shapes agree; if they ever
 * drift, BrandService fails to typecheck — the right place to find out.
 */
export type BrandCreated = {
  readonly type: typeof BRAND_CREATED
  readonly aggregateType: 'Brand'
  readonly aggregateId: string
  readonly payload: { id: string; slug: string; name: string }
  readonly occurredAt: Date
}

export function brandCreated(brand: Brand, occurredAt: Date = brand.createdAt): BrandCreated {
  return {
    type: BRAND_CREATED,
    aggregateType: 'Brand',
    aggregateId: brand.id,
    payload: { id: brand.id, slug: brand.slug, name: brand.name },
    occurredAt,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --filter=api`
Expected: PASS, twelve tests.

- [ ] **Step 5: Verify the layering and commit**

Run: `pnpm boundaries --filter=api && pnpm check`
Expected: green — `domain-is-pure` sees only `@ds/persian` and the `shared/ids` barrel.

```bash
git add apps/api/src/modules/catalog/domain
git commit -m "feat(api): add the Brand aggregate and its created event"
```

---

## Task 4: Application — the port, `BrandService`, the created-event handler

Spec §5.7 (Application), §6.4 (explicit transactions), §5.6 (the outbox), §14 step 5 (a logging handler). `application/**` imports the domain, `infra/*` barrels and `shared/*` barrels — never `infrastructure/**` (the `application-uses-ports` rule). Deviations 1, 8, 9.

**Files:**

- Create: `apps/api/src/modules/catalog/application/brand.repository.ts`, `brand.service.ts`, `brand-created.logger.ts`
- Test: `apps/api/src/modules/catalog/application/brand.service.test.ts`, `brand-created.logger.test.ts`

**Interfaces:**

- Consumes: `DRIZZLE`, `type Db` (`infra/db`); `EventPublisher`, `OnDomainEvent`, `ON_DOMAIN_EVENT` (`infra/outbox`); `NotFoundError` (`shared/errors`); `Brand`, `CreateBrandInput`, `brandCreated`, `BRAND_CREATED` (Task 3); `Brand as BrandDto`, `BrandListQuery`, `BrandListResponse` (Task 1).
- Produces: `abstract class BrandRepository { insert(brand: Brand, tx: Db): Promise<void>; findBySlug(slug: string, tx?: Db): Promise<Brand | null>; list(page: PageInput, tx?: Db): Promise<BrandPage> }`; `type PageInput = { page: number; pageSize: number }`; `type BrandPage = { items: readonly Brand[]; total: number }`; `class BrandService { list(query: BrandListQuery): Promise<BrandListResponse>; findBySlug(slug): Promise<Brand | null>; getBySlug(slug): Promise<Brand>; create(input: CreateBrandInput): Promise<Brand> }`; `toDto(brand: Brand): BrandDto`; `class BrandCreatedLogger` with `onBrandCreated(payload)` decorated `@OnDomainEvent('catalog.brand.created')`.

Unit tests here import the `infra/db` barrel, which loads `ConfigModule` and validates the environment at import; `apps/api/vitest.config.ts` supplies a schema-valid one with every store on a closed port, so nothing connects.

- [ ] **Step 1: Write the failing service test**

`apps/api/src/modules/catalog/application/brand.service.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Db } from '../../../infra/db/index.js'
import type { DomainEvent, EventPublisher } from '../../../infra/outbox/index.js'
import { NotFoundError } from '../../../shared/errors/index.js'
import type { Brand } from '../domain/brand.js'
import type { BrandPage, BrandRepository, PageInput } from './brand.repository.js'
import { BrandService, toDto } from './brand.service.js'

/** In memory, in insertion order; `tx` is recorded so a test can see it was threaded through. */
class FakeBrandRepository implements BrandRepository {
  readonly rows: Brand[] = []
  readonly seenTx: unknown[] = []

  async insert(brand: Brand, tx: Db): Promise<void> {
    this.seenTx.push(tx)
    this.rows.push(brand)
  }

  async findBySlug(slug: string): Promise<Brand | null> {
    return this.rows.find((row) => row.slug === slug) ?? null
  }

  async list({ page, pageSize }: PageInput): Promise<BrandPage> {
    const start = (page - 1) * pageSize
    return { items: this.rows.slice(start, start + pageSize), total: this.rows.length }
  }
}

class FakePublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  readonly seenTx: unknown[] = []

  async publish(event: DomainEvent, tx: Db): Promise<void> {
    this.seenTx.push(tx)
    this.events.push(event)
  }
}

// The one thing the service calls on Db: a transaction that hands the
// callback a marker, so a test can assert the same marker reached both ports.
const TX = { marker: 'tx' } as unknown as Db
const fakeDb = {
  transaction: <T>(fn: (tx: Db) => Promise<T>): Promise<T> => fn(TX),
} as unknown as Db

function makeService() {
  const repo = new FakeBrandRepository()
  const publisher = new FakePublisher()
  return { service: new BrandService(fakeDb, repo, publisher), repo, publisher }
}

describe('BrandService', () => {
  it('creates the brand and its event inside one transaction', async () => {
    const { service, repo, publisher } = makeService()
    const brand = await service.create({ slug: 'muscletech', name: 'ماسل‌تک' })
    expect(repo.rows).toEqual([brand])
    expect(publisher.events).toEqual([
      expect.objectContaining({ type: 'catalog.brand.created', aggregateId: brand.id }),
    ])
    expect(repo.seenTx).toEqual([TX])
    expect(publisher.seenTx).toEqual([TX])
  })

  it('findBySlug answers null and getBySlug throws the catalog 404 for an unknown slug', async () => {
    const { service } = makeService()
    await expect(service.findBySlug('nope')).resolves.toBeNull()
    await expect(service.getBySlug('nope')).rejects.toBeInstanceOf(NotFoundError)
    await expect(service.getBySlug('nope')).rejects.toMatchObject({
      code: 'CATALOG_BRAND_NOT_FOUND',
      status: 404,
    })
  })

  it('lists the page envelope with ISO timestamps and no undefined description key', async () => {
    const { service } = makeService()
    await service.create({ slug: 'bsn', name: 'بی‌اس‌ان' })
    const page = await service.list({ page: 1, pageSize: 20 })
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 1 })
    expect(page.items[0]).not.toHaveProperty('description')
    expect(page.items[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('pages past the end as an empty list with the true total', async () => {
    const { service } = makeService()
    await service.create({ slug: 'bsn', name: 'بی‌اس‌ان' })
    await expect(service.list({ page: 99, pageSize: 20 })).resolves.toEqual({
      items: [],
      page: 99,
      pageSize: 20,
      total: 1,
    })
  })
})

describe('toDto', () => {
  it('carries the description only when there is one', async () => {
    const { service } = makeService()
    const withOne = await service.create({ slug: 'a', name: 'الف', description: 'توضیح' })
    const without = await service.create({ slug: 'b', name: 'ب' })
    expect(toDto(withOne)).toMatchObject({ description: 'توضیح' })
    expect(toDto(without)).not.toHaveProperty('description')
  })
})
```

- [ ] **Step 2: Write the failing handler test**

`apps/api/src/modules/catalog/application/brand-created.logger.test.ts`:

```ts
import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { ON_DOMAIN_EVENT } from '../../../infra/outbox/index.js'
import { BrandCreatedLogger } from './brand-created.logger.js'

describe('BrandCreatedLogger', () => {
  // What OutboxRelay's discovery scan reads: the metadata sits on the method.
  it('subscribes to catalog.brand.created', () => {
    const type: unknown = Reflect.getMetadata(
      ON_DOMAIN_EVENT,
      BrandCreatedLogger.prototype.onBrandCreated,
    )
    expect(type).toBe('catalog.brand.created')
  })

  it('logs one object naming the brand', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    new BrandCreatedLogger().onBrandCreated({ id: 'x', slug: 'muscletech', name: 'ماسل‌تک' })
    expect(log).toHaveBeenCalledWith({ msg: 'brand created', id: 'x', slug: 'muscletech' })
    log.mockRestore()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test --filter=api`
Expected: FAIL — `Cannot find module './brand.service.js'` and `'./brand-created.logger.js'`.

- [ ] **Step 4: Write the port**

`apps/api/src/modules/catalog/application/brand.repository.ts`:

```ts
import type { Db } from '../../../infra/db/index.js'
import type { Brand } from '../domain/brand.js'

export type PageInput = { readonly page: number; readonly pageSize: number }
export type BrandPage = { readonly items: readonly Brand[]; readonly total: number }

/**
 * The port (§5.3). `tx` is explicit (§6.4): a write takes the caller's
 * transaction; a read may run on the pool. An abstract class rather than an
 * interface so Nest can use it as the injection token that
 * catalog.module.ts binds to the Drizzle adapter. No decorator: the port
 * owes nothing to the framework.
 */
export abstract class BrandRepository {
  abstract insert(brand: Brand, tx: Db): Promise<void>
  abstract findBySlug(slug: string, tx?: Db): Promise<Brand | null>
  abstract list(page: PageInput, tx?: Db): Promise<BrandPage>
}
```

- [ ] **Step 5: Write the service**

`apps/api/src/modules/catalog/application/brand.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import type { Brand as BrandDto, BrandListQuery, BrandListResponse } from '@ds/contracts'
import { DRIZZLE, type Db } from '../../../infra/db/index.js'
import { EventPublisher } from '../../../infra/outbox/index.js'
import { NotFoundError } from '../../../shared/errors/index.js'
import { Brand, type CreateBrandInput } from '../domain/brand.js'
import { brandCreated } from '../domain/events.js'
import { BrandRepository } from './brand.repository.js'

@Injectable()
export class BrandService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly brands: BrandRepository,
    private readonly events: EventPublisher,
  ) {}

  async list(query: BrandListQuery): Promise<BrandListResponse> {
    const { items, total } = await this.brands.list(query)
    return { items: items.map(toDto), page: query.page, pageSize: query.pageSize, total }
  }

  /** `null` for "not there" — what the seed asks. */
  findBySlug(slug: string): Promise<Brand | null> {
    return this.brands.findBySlug(slug)
  }

  /** The 404 the controller lets through to ProblemFilter — what a route asks. */
  async getBySlug(slug: string): Promise<Brand> {
    const brand = await this.brands.findBySlug(slug)
    if (brand === null) {
      throw new NotFoundError('CATALOG_BRAND_NOT_FOUND', `No brand has the slug "${slug}"`)
    }
    return brand
  }

  /**
   * Used by the seed and by tests — there is no HTTP route (§5.7). The row
   * and its outbox event land in one transaction (§6.4); a duplicate slug
   * surfaces as the repository's ConflictError and rolls both back.
   */
  async create(input: CreateBrandInput): Promise<Brand> {
    const brand = Brand.create(input)
    await this.db.transaction(async (tx) => {
      await this.brands.insert(brand, tx)
      await this.events.publish(brandCreated(brand), tx)
    })
    return brand
  }
}

/** The entity as the HTTP shape (§8.1): ISO strings, and no `description` key when there is none. */
export function toDto(brand: Brand): BrandDto {
  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    ...(brand.description === undefined ? {} : { description: brand.description }),
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  }
}
```

`BrandRepository` and `EventPublisher` are value imports on purpose: Nest resolves constructor parameters from `design:paramtypes`, which a type-only import never emits (the `nestjs.json` note in the memory of Phase 1).

- [ ] **Step 6: Write the handler**

`apps/api/src/modules/catalog/application/brand-created.logger.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common'
import { OnDomainEvent } from '../../../infra/outbox/index.js'
import { BRAND_CREATED } from '../domain/events.js'

/**
 * The first consumer of a domain event (foundation §14 step 5): it proves the
 * outbox delivers `catalog.brand.created` end to end and does nothing else.
 * Idempotent by construction — a line logged twice is not a defect. It is a
 * provider of CatalogModule so OutboxRelay's discovery scan finds it.
 */
@Injectable()
export class BrandCreatedLogger {
  private readonly logger = new Logger(BrandCreatedLogger.name)

  @OnDomainEvent(BRAND_CREATED)
  onBrandCreated(payload: Record<string, unknown>): void {
    this.logger.log({ msg: 'brand created', id: payload['id'], slug: payload['slug'] })
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test --filter=api`
Expected: PASS — five service tests, two handler tests.

- [ ] **Step 8: Verify the layering and commit**

Run: `pnpm boundaries --filter=api && pnpm check`
Expected: green — `application-uses-ports` sees no `infrastructure/` import.

```bash
git add apps/api/src/modules/catalog/application
git commit -m "feat(api): add BrandService, its repository port and the created-event logger"
```

---

## Task 5: Infrastructure — the `brands` table, the migration, the Drizzle repository

Spec §5.7 (Infrastructure, API ordering), §6.3 (the Persian-text row: `search_text`, `gin_trgm_ops`, `COLLATE "fa"`), `db.md`. Deviations 2, 3. Review Focus 4 and 5. Needs Docker for the integration steps.

**Files:**

- Create: `apps/api/src/modules/catalog/infrastructure/schema.ts`, `apps/api/src/modules/catalog/infrastructure/brand.repository.ts`
- Generated then committed: `apps/api/drizzle/0002_brands.sql`, `apps/api/drizzle/meta/0002_snapshot.json`, `apps/api/drizzle/meta/_journal.json`
- Test: `apps/api/test/integration/catalog-brands.test.ts`

**Interfaces:**

- Consumes: `BrandRepository`, `PageInput`, `BrandPage` (Task 4); `Brand` (Task 3); `DRIZZLE`, `Db`; `ConflictError`.
- Produces: `brands` (the Drizzle table; columns `id slug name description searchText createdAt updatedAt`); `class DrizzleBrandRepository extends BrandRepository`; the applied migration `0002_brands`.

- [ ] **Step 1: Write the schema**

`apps/api/src/modules/catalog/infrastructure/schema.ts`:

```ts
import { sql, type SQL } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

/**
 * `brands` (foundation §6.3). Keys are camelCase; `casing: 'snake_case'`
 * derives the real names. `search_text` is the search pattern: the name with
 * every ZWNJ turned into a space, stored, and indexed with pg_trgm so a
 * search for «ماسل تک» finds «ماسل‌تک». Display reads `name`, never this.
 * The checks repeat the entity's invariants at the table (db.md).
 */
export const brands = pgTable(
  'brands',
  {
    id: uuid().primaryKey(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    searchText: text().generatedAlwaysAs((): SQL => sql`replace(${brands.name}, chr(8204), ' ')`),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    unique('brands_slug_key').on(t.slug),
    index('brands_search_text_idx').using('gin', t.searchText.op('gin_trgm_ops')),
    check('brands_slug_check', sql`${t.slug} ~ '^[a-z0-9-]+$' and char_length(${t.slug}) <= 64`),
    check('brands_name_check', sql`char_length(${t.name}) between 1 and 200`),
    check(
      'brands_description_check',
      sql`${t.description} is null or char_length(${t.description}) between 1 and 2000`,
    ),
  ],
)
```

`gin_trgm_ops` is not in drizzle's typed list of operator classes, but `PgIndexOpClass` ends in `(string & {})`, so `.op('gin_trgm_ops')` type-checks and drizzle-kit writes it verbatim (verified against drizzle-orm 0.45.3's `pg-core/indexes.d.ts`).

- [ ] **Step 2: Generate the migration and read it**

Run: `pnpm db:generate --name=brands`
Expected: `apps/api/drizzle/0002_brands.sql`, `drizzle/meta/0002_snapshot.json`, and a third entry in `drizzle/meta/_journal.json`.

Run: `cat apps/api/drizzle/0002_brands.sql`
Expected, allowing for quoting and whitespace differences:

```sql
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"search_text" text GENERATED ALWAYS AS (replace("brands"."name", chr(8204), ' ')) STORED,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "brands_slug_key" UNIQUE("slug"),
	CONSTRAINT "brands_slug_check" CHECK ("brands"."slug" ~ '^[a-z0-9-]+$' and char_length("brands"."slug") <= 64),
	CONSTRAINT "brands_name_check" CHECK (char_length("brands"."name") between 1 and 200),
	CONSTRAINT "brands_description_check" CHECK ("brands"."description" is null or char_length("brands"."description") between 1 and 2000)
);
--> statement-breakpoint
CREATE INDEX "brands_search_text_idx" ON "brands" USING gin ("search_text" gin_trgm_ops);
```

Four things must be present or the schema is wrong, not the plan: `GENERATED ALWAYS AS (…) STORED`, `USING gin (… gin_trgm_ops)`, the `UNIQUE("slug")` constraint named `brands_slug_key`, and the three `CHECK`s. Paste the file into the task report. Never edit the SQL by hand; fix `schema.ts`, delete the three generated files, and generate again.

- [ ] **Step 3: Apply it locally**

Run: `pnpm db:up && pnpm db:migrate`
Expected: `0002_brands` applied. If Postgres answers `collation provider "icu" is not supported`, stop: the Phase 2 rule is to order by `search_text` instead and write an ADR — never to drop the collation silently.

- [ ] **Step 4: Write the failing integration test**

`apps/api/test/integration/catalog-brands.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Module } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { Db } from '../../src/infra/db/index.js'
import { ConflictError } from '../../src/shared/errors/index.js'
import { BrandRepository } from '../../src/modules/catalog/application/brand.repository.js'
import { Brand } from '../../src/modules/catalog/domain/brand.js'
import { DrizzleBrandRepository } from '../../src/modules/catalog/infrastructure/brand.repository.js'
import { withDb, type DbFixture } from '../setup/fixture.js'

@Module({ providers: [{ provide: BrandRepository, useClass: DrizzleBrandRepository }] })
class RepositoryModule {}

/** The six seed names (§5.7) in the order ICU's fa collation puts them. */
const FA_ORDER = ['اپتیموم نوتریشن', 'بی‌اس‌ان', 'دایماتایز', 'ماسل‌تک', 'مای‌پروتئین', 'نوترکس']

/** Deliberately not in that order. */
const SIX = [
  { slug: 'nutrex', name: 'نوترکس' },
  { slug: 'muscletech', name: 'ماسل‌تک' },
  { slug: 'optimum-nutrition', name: 'اپتیموم نوتریشن' },
  { slug: 'myprotein', name: 'مای‌پروتئین' },
  { slug: 'bsn', name: 'بی‌اس‌ان' },
  { slug: 'dymatize', name: 'دایماتایز' },
]

/** pg's SQLSTATE, wherever the driver error sits: on the rejection or behind a `cause`. */
function pgCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const direct = (error as { code?: unknown }).code
  if (typeof direct === 'string') return direct
  return pgCode((error as { cause?: unknown }).cause)
}

describe('DrizzleBrandRepository', () => {
  let fixture: DbFixture
  let db: Db
  let repo: BrandRepository

  beforeAll(async () => {
    fixture = await withDb(RepositoryModule)
    db = fixture.db
    repo = fixture.app.get(BrandRepository)
  })

  afterAll(async () => {
    await fixture?.close()
  })

  beforeEach(async () => {
    await fixture.reset()
  })

  async function insertAll(
    inputs: ReadonlyArray<{ slug: string; name: string }>,
  ): Promise<Brand[]> {
    const out: Brand[] = []
    for (const input of inputs) {
      const brand = Brand.create(input)
      await db.transaction((tx) => repo.insert(brand, tx))
      out.push(brand)
    }
    return out
  }

  // Review Focus 4: the row keeps U+200C.
  it('round-trips a brand and keeps the ZWNJ in the stored name', async () => {
    const [brand] = await insertAll([{ slug: 'muscletech', name: 'ماسل‌تک' }])
    const found = await repo.findBySlug('muscletech')
    expect(found?.id).toBe(brand?.id)
    expect(found?.name).toBe('ماسل‌تک')
    expect(found?.name).toContain('‌')
    expect(found?.description).toBeUndefined()
    expect(found?.createdAt).toEqual(brand?.createdAt)
  })

  // §6.3: the generated column turns the ZWNJ into a space, and only there.
  it('derives search_text with the ZWNJ as a space', async () => {
    await insertAll([{ slug: 'muscletech', name: 'ماسل‌تک' }])
    const res = await db.execute(sql`select search_text from brands where slug = 'muscletech'`)
    expect(res.rows[0]).toEqual({ search_text: 'ماسل تک' })
  })

  it('answers null for an unknown slug', async () => {
    await expect(repo.findBySlug('nope')).resolves.toBeNull()
  })

  it('lists in Persian alphabetical order whatever the insertion order', async () => {
    await insertAll(SIX)
    const page = await repo.list({ page: 1, pageSize: 20 })
    expect(page.total).toBe(6)
    expect(page.items.map((b) => b.name)).toEqual(FA_ORDER)
  })

  it('pages with the true total and an empty page past the end', async () => {
    await insertAll(SIX)
    const second = await repo.list({ page: 2, pageSize: 4 })
    expect(second.items.map((b) => b.name)).toEqual(FA_ORDER.slice(4))
    expect(second.total).toBe(6)
    const past = await repo.list({ page: 99, pageSize: 4 })
    expect(past.items).toEqual([])
    expect(past.total).toBe(6)
  })

  it('maps a duplicate slug to CATALOG_BRAND_SLUG_TAKEN', async () => {
    await insertAll([{ slug: 'bsn', name: 'بی‌اس‌ان' }])
    const again = Brand.create({ slug: 'bsn', name: 'بی اس ان' })
    const attempt = db.transaction((tx) => repo.insert(again, tx))
    await expect(attempt).rejects.toBeInstanceOf(ConflictError)
    await expect(attempt).rejects.toMatchObject({ code: 'CATALOG_BRAND_SLUG_TAKEN', status: 409 })
    expect((await repo.list({ page: 1, pageSize: 20 })).total).toBe(1)
  })

  // Review Focus 5: names that differ only by a ZWNJ are two brands
  // (uniqueness is on the slug) with one search_text, listed deterministically.
  it('keeps two names that differ only by ZWNJ as two rows with one search_text', async () => {
    await insertAll([
      { slug: 'muscletech', name: 'ماسل‌تک' },
      { slug: 'muscle-tech', name: 'ماسل تک' },
    ])
    const res = await db.execute(sql`select count(distinct search_text)::int as n from brands`)
    expect(res.rows[0]).toEqual({ n: 1 })
    const page = await repo.list({ page: 1, pageSize: 20 })
    expect(page.items.map((b) => b.slug).sort()).toEqual(['muscle-tech', 'muscletech'])
  })

  // db.md: invariants are constraints. The entity refuses these first; the
  // table refuses them from any path that bypasses it. 23514 is check_violation.
  it('refuses an invalid slug and an empty name at the table', async () => {
    const raw = (slug: string, name: string) =>
      db.execute(
        sql`insert into brands (id, slug, name, created_at, updated_at) values (gen_random_uuid(), ${slug}, ${name}, now(), now())`,
      )
    await expect(raw('MuscleTech', 'نام').catch(pgCode)).resolves.toBe('23514')
    await expect(raw('ok', '').catch(pgCode)).resolves.toBe('23514')
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test:integration --filter=api`
Expected: FAIL — `Cannot find module '../../src/modules/catalog/infrastructure/brand.repository.js'`. (The build turbo runs first succeeds: `schema.ts` compiles on its own.)

- [ ] **Step 6: Write the repository**

`apps/api/src/modules/catalog/infrastructure/brand.repository.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import { count, eq, sql } from 'drizzle-orm'
import { DRIZZLE, type Db } from '../../../infra/db/index.js'
import { ConflictError } from '../../../shared/errors/index.js'
import { BrandRepository, type BrandPage, type PageInput } from '../application/brand.repository.js'
import { Brand } from '../domain/brand.js'
import { brands } from './schema.js'

/** pg's SQLSTATE for a unique violation. */
const UNIQUE_VIOLATION = '23505'

@Injectable()
export class DrizzleBrandRepository extends BrandRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {
    super()
  }

  /** A plain INSERT (§5.7): the unique constraint is the invariant, and its violation is the 409. */
  async insert(brand: Brand, tx: Db): Promise<void> {
    try {
      await tx.insert(brands).values({
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        ...(brand.description === undefined ? {} : { description: brand.description }),
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
      })
    } catch (error) {
      if (isUniqueViolation(error, 'brands_slug_key')) {
        throw new ConflictError(
          'CATALOG_BRAND_SLUG_TAKEN',
          `A brand with the slug "${brand.slug}" already exists`,
        )
      }
      throw error
    }
  }

  async findBySlug(slug: string, tx: Db = this.db): Promise<Brand | null> {
    const rows = await tx.select().from(brands).where(eq(brands.slug, slug)).limit(1)
    const row = rows[0]
    return row === undefined ? null : toEntity(row)
  }

  /** `ORDER BY name COLLATE "fa", id` (§5.7): Persian alphabetical, deterministic on ties. */
  async list({ page, pageSize }: PageInput, tx: Db = this.db): Promise<BrandPage> {
    const rows = await tx
      .select()
      .from(brands)
      .orderBy(sql`${brands.name} collate "fa"`, brands.id)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const totals = await tx.select({ total: count() }).from(brands)
    return { items: rows.map(toEntity), total: totals[0]?.total ?? 0 }
  }
}

function toEntity(row: typeof brands.$inferSelect): Brand {
  return Brand.rehydrate({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

/**
 * pg raises 23505 with the constraint's name. Drizzle 0.45 re-throws the
 * driver error as it is; a later Drizzle may wrap it, so `cause` is checked too.
 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { code?: unknown; constraint?: unknown; cause?: unknown }
  if (e.code === UNIQUE_VIOLATION && e.constraint === constraint) return true
  return isUniqueViolation(e.cause, constraint)
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test:integration --filter=api`
Expected: PASS, eight tests. If the ordering test fails, record the order Postgres returned in the task report before touching anything: the expected list was derived from ICU's `fa` tailoring, and a difference is a finding about the collation, not a reason to reorder the fixture.

- [ ] **Step 8: Verify and commit**

Run: `pnpm check`
Expected: green — `boundaries` accepts `infrastructure → application` (the adapter implements the port) and `openapi.test.ts` still passes (no route yet, and the repository opens no connection at boot).

```bash
git add apps/api/src/modules/catalog/infrastructure apps/api/drizzle apps/api/test/integration/catalog-brands.test.ts
git commit -m "feat(api): add the brands table, its migration and the Drizzle repository"
```

---

## Task 6: `@ds/api-client` — the typed client over the generated schema

Spec §8.2, §7.4 (`publicApi`), `generated.md`, north-star §2 rule 2 (types only from contracts). Deviations 4, 5. The package is created against the health-only `openapi.json` that exists now; Task 7 regenerates it with the brand routes.

**Files:**

- Create: `packages/api-client/package.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.js`, `vitest.config.ts`, `test/stubs/server-only.ts`, `src/index.ts`, `src/errors.ts`, `src/server.ts`
- Generated then committed: `packages/api-client/src/generated/schema.d.ts`
- Modify: `scripts/check-docs.manifest`
- Test: `packages/api-client/src/index.test.ts`, `packages/api-client/src/server.test.ts`

**Interfaces:**

- Consumes: `paths` from `src/generated/schema.d.ts`; `type ErrorCode`, `type ProblemDetails` from `@ds/contracts`; `openapi-fetch`'s `createClient`, `Client`, `Middleware`.
- Produces: `createApiClient({ baseUrl, headers?, fetch? }): ApiClient`, `type ApiClient = Client<paths>`, `class ApiError extends Error { status; code: ErrorCode; detail; instance; errors }`, `type { paths }` from `@ds/api-client`; `publicApi: ApiClient` and `getPublicApi(): ApiClient` from `@ds/api-client/server`.

- [ ] **Step 1: Write the package and its configuration**

`packages/api-client/package.json`:

```json
{
  "name": "@ds/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./server": {
      "types": "./dist/server.d.ts",
      "default": "./dist/server.js"
    }
  },
  "scripts": {
    "build": "tsc -b tsconfig.build.json",
    "dev": "tsc -b tsconfig.build.json --watch",
    "generate": "openapi-typescript ../../apps/api/openapi.json -o src/generated/schema.d.ts",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ds/contracts": "workspace:*",
    "openapi-fetch": "catalog:",
    "server-only": "catalog:"
  },
  "devDependencies": {
    "@ds/config-eslint": "workspace:*",
    "@ds/config-typescript": "workspace:*",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "openapi-typescript": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`packages/api-client/tsconfig.json`:

```json
{
  "extends": "@ds/config-typescript/library.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "." },
  "include": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts", "eslint.config.js"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

`packages/api-client/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "coverage", "**/*.test.ts"]
}
```

`packages/api-client/eslint.config.js`:

```js
// @ts-check
import base from '@ds/config-eslint/base'

export default [{ ignores: ['dist/**', 'src/generated/**'] }, ...base]
```

`packages/api-client/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws outside a React Server Components runtime; the
      // server entry is tested here as a plain module, as apps/web does it.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: { include: ['src/**/*.test.ts'], clearMocks: true },
})
```

`packages/api-client/test/stubs/server-only.ts`:

```ts
// Stands in for the `server-only` package under Vitest (see vitest.config.ts).
export {}
```

Append to `scripts/check-docs.manifest`:

```
packages/api-client/package.json
packages/api-client/tsconfig.json
packages/api-client/tsconfig.build.json
packages/api-client/eslint.config.js
packages/api-client/vitest.config.ts
```

Run: `pnpm install`
Expected: the workspace links the new package; `openapi-fetch`, `openapi-typescript` and `server-only` resolve from the catalog.

- [ ] **Step 2: Generate the schema from the current document**

Run: `pnpm openapi:generate`
Expected: turbo builds `@ds/persian`, `@ds/contracts` and `api`, runs `api#openapi` (`node dist/openapi.js`, which reads `apps/api/.env`), then `@ds/api-client#generate`; `packages/api-client/src/generated/schema.d.ts` appears with `paths` for `/health/live` and `/health/ready`. It is prettier-ignored and eslint-ignored already. Do not edit it.

- [ ] **Step 3: Write the failing tests**

`packages/api-client/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ApiError, createApiClient } from './index.js'

function fakeFetch(status: number, body: unknown, contentType = 'application/json') {
  const calls: Request[] = []
  const fetch = async (input: Request): Promise<Response> => {
    calls.push(input)
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': contentType },
    })
  }
  return { fetch, calls }
}

const BASE = 'http://api.internal:3001'

describe('createApiClient', () => {
  it('resolves data on a 200 and builds the URL from the base', async () => {
    const { fetch, calls } = fakeFetch(200, { status: 'ok' })
    const api = createApiClient({ baseUrl: BASE, fetch })
    const { data } = await api.GET('/health/live')
    expect(data).toMatchObject({ status: 'ok' })
    expect(calls[0]?.url).toBe('http://api.internal:3001/health/live')
  })

  it('throws an ApiError carrying the problem on a problem+json response', async () => {
    const problem = {
      type: 'urn:problem:RATE_LIMITED',
      title: 'Rate Limited',
      status: 429,
      instance: 'req-1',
      code: 'RATE_LIMITED',
      detail: 'Try again later',
    }
    const { fetch } = fakeFetch(429, problem, 'application/problem+json')
    const api = createApiClient({ baseUrl: BASE, fetch })
    const attempt = api.GET('/health/live')
    await expect(attempt).rejects.toBeInstanceOf(ApiError)
    await expect(attempt).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      instance: 'req-1',
      detail: 'Try again later',
      message: 'Try again later',
    })
  })

  it('maps a failure that is not a problem to INTERNAL with the status', async () => {
    const { fetch } = fakeFetch(502, undefined, 'text/html')
    const api = createApiClient({ baseUrl: BASE, fetch })
    await expect(api.GET('/health/live')).rejects.toMatchObject({ code: 'INTERNAL', status: 502 })
  })

  it('sends the default headers', async () => {
    const { fetch, calls } = fakeFetch(200, { status: 'ok' })
    const api = createApiClient({ baseUrl: BASE, headers: { 'x-request-id': 'abc' }, fetch })
    await api.GET('/health/live')
    expect(calls[0]?.headers.get('x-request-id')).toBe('abc')
  })
})
```

`packages/api-client/src/server.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

// The client is a process-wide singleton, so the module is loaded afresh per
// test; `server-only` is aliased to a stub in vitest.config.ts.
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('publicApi', () => {
  it('reads nothing at import and fails clearly on first use without the variable', async () => {
    vi.stubEnv('API_INTERNAL_URL', '')
    const { publicApi } = await import('./server.js')
    expect(() => publicApi.GET).toThrow(/API_INTERNAL_URL/)
  })

  it('builds one client from API_INTERNAL_URL on first use', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://127.0.0.1:9')
    const { getPublicApi, publicApi } = await import('./server.js')
    expect(getPublicApi()).toBe(getPublicApi())
    expect(typeof publicApi.GET).toBe('function')
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm test --filter=@ds/api-client`
Expected: FAIL — `Cannot find module './index.js'` and `'./server.js'`.

- [ ] **Step 5: Write the errors, the factory and the server entry**

`packages/api-client/src/errors.ts`:

```ts
import type { ErrorCode, ProblemDetails } from '@ds/contracts'

/**
 * A problem+json response as an exception (foundation §7.6). The storefront
 * maps `code` to a Persian sentence in lib/errors.ts; `instance` is the
 * request id, worth logging next to any report.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly detail: string | undefined
  readonly instance: string
  readonly errors: ProblemDetails['errors']

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.code = problem.code
    this.detail = problem.detail
    this.instance = problem.instance
    this.errors = problem.errors
  }
}

/**
 * A structural check, not a Zod parse: this package takes only types from
 * @ds/contracts (north-star §2 rule 2), and the API is our own, so a
 * problem-shaped body is trusted as one.
 */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['type'] === 'string' &&
    typeof v['title'] === 'string' &&
    typeof v['status'] === 'number' &&
    typeof v['instance'] === 'string' &&
    typeof v['code'] === 'string'
  )
}
```

`packages/api-client/src/index.ts`:

```ts
import createClient, { type Client, type Middleware } from 'openapi-fetch'
import type { paths } from './generated/schema.js'
import { ApiError, isProblemDetails } from './errors.js'

export { ApiError } from './errors.js'
export type { paths } from './generated/schema.js'

export type ApiClient = Client<paths>

export type ApiClientOptions = {
  readonly baseUrl: string
  /** Sent on every request; requestApi() (the identity spec) will forward cookies and ids through it. */
  readonly headers?: Record<string, string>
  /** For tests: what openapi-fetch calls instead of the global fetch. */
  readonly fetch?: (input: Request) => Promise<Response>
}

/**
 * openapi-fetch over the generated paths (foundation §8.2). A response that
 * is not ok becomes an `ApiError` in middleware, so a caller gets `data` or
 * an exception — never an `{ error }` branch to forget.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  })
  client.use(problemToError)
  return client
}

const problemToError: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return undefined
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined)
    if (isProblemDetails(body)) throw new ApiError(body)
    throw new ApiError({
      type: 'about:blank',
      title: response.statusText || `HTTP ${response.status}`,
      status: response.status,
      instance: response.headers.get('x-request-id') ?? '',
      code: 'INTERNAL',
    })
  },
}
```

`packages/api-client/src/server.ts`:

```ts
import 'server-only'
import { createApiClient, type ApiClient } from './index.js'

let client: ApiClient | undefined

function baseUrl(): string {
  const raw = process.env['API_INTERNAL_URL']
  if (raw === undefined || raw === '') {
    throw new Error(
      'API_INTERNAL_URL is not set; the storefront reads it at request time (foundation §7.1)',
    )
  }
  return new URL(raw).href
}

/**
 * The storefront's server-side client (foundation §7.4): no request context,
 * so it may run inside 'use cache'. Built on first use, never at import —
 * `next build` runs with API_INTERNAL_URL on a closed port and must not care
 * (DoD 9). One client per process; 'use cache' memoises the calls.
 */
export function getPublicApi(): ApiClient {
  client ??= createApiClient({ baseUrl: baseUrl() })
  return client
}

/** `publicApi.GET(...)` reads like a client and resolves to the singleton on first use. */
export const publicApi: ApiClient = new Proxy({} as ApiClient, {
  get(_target, property) {
    const real = getPublicApi() as unknown as Record<PropertyKey, unknown>
    const value = real[property]
    return typeof value === 'function' ? value.bind(real) : value
  },
})
```

The middleware signature (`onResponse({ request, response, options })`, an error thrown inside it rejecting the original call) was verified against openapi-fetch's documentation on 2026-09-25; `pnpm typecheck` re-verifies it against the installed 0.17.0 types.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test --filter=@ds/api-client`
Expected: PASS, six tests.

- [ ] **Step 7: Verify and commit**

Run: `pnpm check`
Expected: green — the new package lints, typechecks, builds and tests inside turbo; `sherif` sees consistent `catalog:` specifiers; `check:docs` finds the five manifest entries.

```bash
git add packages/api-client pnpm-lock.yaml scripts/check-docs.manifest
git commit -m "feat(api-client): add the typed client over the generated OpenAPI schema"
```

---

## Task 7: API — the two routes, the module, the registration, the regenerated document

Spec §5.7 (API), §5.3 (only the module file wires ports to adapters), §14 steps 2–3, `api.md`. Review Focus 1 and 2. Deviation 10.

**Files:**

- Create: `apps/api/src/modules/catalog/api/brands.controller.ts`, `apps/api/src/modules/catalog/catalog.module.ts`, `apps/api/src/modules/catalog/index.ts`
- Modify: `apps/api/src/app.module.ts`
- Regenerated then committed: `apps/api/openapi.json`, `packages/api-client/src/generated/schema.d.ts`
- Test: `apps/api/test/integration/catalog-http.test.ts`; extend `packages/api-client/src/index.test.ts`

**Interfaces:**

- Consumes: `BrandService`, `toDto` (Task 4); `DrizzleBrandRepository` (Task 5); `BrandRepository` (Task 4); `BrandCreatedLogger` (Task 4); `OutboxModule`; `ApiZodResponse`; the contracts (Task 1); `slug`, `ProblemDetailsSchema`.
- Produces: `GET /catalog/brands?page&pageSize` → `BrandListResponse`; `GET /catalog/brands/:slug` → `Brand` or `404 CATALOG_BRAND_NOT_FOUND`; `CatalogModule`; `modules/catalog/index.ts` exporting `CatalogModule`, `BrandService` and `tables`; the document and the client types carrying both routes.

- [ ] **Step 1: Write the failing HTTP test**

`apps/api/test/integration/catalog-http.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { OpenAPIObject, ReferenceObject, SchemaObject } from '@nestjs/swagger'
import { BrandListResponseSchema, BrandSchema, ProblemDetailsSchema } from '@ds/contracts'
import { createApp } from '../../src/app.factory.js'
import { AppConfig } from '../../src/infra/config/index.js'
import { DRIZZLE, type Db } from '../../src/infra/db/index.js'
import { BrandService } from '../../src/modules/catalog/index.js'
import { buildDocument } from '../../src/shared/openapi/index.js'
import { resetDb } from '../setup/fixture.js'
import { flushRedis } from '../setup/truncate.js'

const FA_ORDER = ['اپتیموم نوتریشن', 'بی‌اس‌ان', 'دایماتایز', 'ماسل‌تک', 'مای‌پروتئین', 'نوترکس']
const SIX = [
  { slug: 'nutrex', name: 'نوترکس' },
  { slug: 'muscletech', name: 'ماسل‌تک' },
  { slug: 'optimum-nutrition', name: 'اپتیموم نوتریشن' },
  { slug: 'myprotein', name: 'مای‌پروتئین' },
  { slug: 'bsn', name: 'بی‌اس‌ان' },
  { slug: 'dymatize', name: 'دایماتایز' },
]

const isRef = (value: object): value is ReferenceObject => '$ref' in value

/** The `application/json` schema of one GET response, ref or inline. */
function responseSchema(
  doc: OpenAPIObject,
  path: string,
  status: string,
): SchemaObject | ReferenceObject | undefined {
  const response = doc.paths[path]?.get?.responses[status]
  if (response === undefined || isRef(response)) return undefined
  return response.content?.['application/json']?.schema
}

/** Follows `#/components/schemas/<name>` once; `.meta({ id })` may or may not produce a ref (plan deviation 10). */
function deref(
  doc: OpenAPIObject,
  schema: SchemaObject | ReferenceObject | undefined,
): SchemaObject | undefined {
  if (schema === undefined) return undefined
  if (isRef(schema)) {
    const target = doc.components?.schemas?.[schema.$ref.replace('#/components/schemas/', '')]
    return target === undefined || isRef(target) ? undefined : target
  }
  return schema
}

// The production wiring, as app.factory.test.ts boots it: the validation
// pipe, ProblemFilter, the Redis throttle. Isolation is the fixture's
// truncation plus a Redis flush so throttle counters never carry over.
describe('the catalog routes', () => {
  let app: NestFastifyApplication
  let db: Db

  beforeAll(async () => {
    app = await createApp()
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    db = app.get<Db>(DRIZZLE)
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(async () => {
    await resetDb(db)
    await flushRedis(app.get(AppConfig).redisUrl)
    const brands = app.get(BrandService)
    for (const input of SIX) await brands.create(input)
  })

  describe('GET /catalog/brands', () => {
    it('lists the six brands in Persian order inside the page envelope', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands' })
      expect(res.statusCode).toBe(200)
      const body = BrandListResponseSchema.strict().parse(res.json())
      expect(body.total).toBe(6)
      expect(body.items.map((b) => b.name)).toEqual(FA_ORDER)
    })

    // Review Focus 2.
    it('pages, and answers an empty page past the end with the true total', async () => {
      const second = await app.inject({ method: 'GET', url: '/catalog/brands?page=2&pageSize=4' })
      expect(second.statusCode).toBe(200)
      const body = BrandListResponseSchema.parse(second.json())
      expect(body).toMatchObject({ page: 2, pageSize: 4, total: 6 })
      expect(body.items.map((b) => b.name)).toEqual(FA_ORDER.slice(4))
      const past = await app.inject({ method: 'GET', url: '/catalog/brands?page=99' })
      expect(past.statusCode).toBe(200)
      expect(past.json()).toMatchObject({ items: [], page: 99, pageSize: 20, total: 6 })
    })

    it('rejects an invalid query as a 400 problem naming the member', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands?pageSize=101' })
      expect(res.statusCode).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
      const problem = ProblemDetailsSchema.parse(res.json())
      expect(problem.code).toBe('VALIDATION_FAILED')
      expect(problem.errors?.[0]?.path).toBe('pageSize')
    })
  })

  describe('GET /catalog/brands/:slug', () => {
    it('returns the brand with its ZWNJ intact', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands/muscletech' })
      expect(res.statusCode).toBe(200)
      const brand = BrandSchema.strict().parse(res.json())
      expect(brand.name).toBe('ماسل‌تک')
      expect(brand.name).toContain('‌')
      expect(brand).not.toHaveProperty('description')
    })

    it('answers 404 CATALOG_BRAND_NOT_FOUND as problem+json for an unknown slug', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands/no-such-brand' })
      expect(res.statusCode).toBe(404)
      expect(res.headers['content-type']).toContain('application/problem+json')
      expect(ProblemDetailsSchema.parse(res.json())).toMatchObject({
        code: 'CATALOG_BRAND_NOT_FOUND',
        status: 404,
        title: 'Brand Not Found',
      })
    })

    // Review Focus 1: malformed is 400, never 404.
    it('answers 400 naming slug for a slug that is not lowercase Latin', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/brands/MuscleTech' })
      expect(res.statusCode).toBe(400)
      expect(ProblemDetailsSchema.parse(res.json()).errors?.[0]?.path).toBe('slug')
    })
  })

  describe('the OpenAPI document', () => {
    it('documents both routes with the brand shapes', () => {
      const doc = buildDocument(app)
      expect(Object.keys(doc.paths)).toEqual(
        expect.arrayContaining(['/catalog/brands', '/catalog/brands/{slug}']),
      )
      const item = deref(doc, responseSchema(doc, '/catalog/brands/{slug}', '200'))
      expect(Object.keys(item?.properties ?? {}).sort()).toEqual([
        'createdAt',
        'description',
        'id',
        'name',
        'slug',
        'updatedAt',
      ])
      const list = deref(doc, responseSchema(doc, '/catalog/brands', '200'))
      expect(Object.keys(list?.properties ?? {}).sort()).toEqual([
        'items',
        'page',
        'pageSize',
        'total',
      ])
      expect(deref(doc, responseSchema(doc, '/catalog/brands/{slug}', '404'))?.required).toEqual([
        'type',
        'title',
        'status',
        'instance',
        'code',
      ])
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration --filter=api`
Expected: FAIL — `Cannot find module '../../src/modules/catalog/index.js'`.

- [ ] **Step 3: Write the controller**

`apps/api/src/modules/catalog/api/brands.controller.ts`:

```ts
import { Controller, Get, Param, Query } from '@nestjs/common'
import {
  type Brand,
  type BrandListQuery,
  type BrandListResponse,
  BrandListQuerySchema,
  BrandListResponseSchema,
  BrandSchema,
  ProblemDetailsSchema,
  slug,
} from '@ds/contracts'
import { ApiZodResponse } from '../../../shared/openapi/index.js'
import { BrandService, toDto } from '../application/brand.service.js'

/**
 * Read-only (§5.7): no unauthenticated write exists anywhere. Validation is
 * the global StandardSchemaValidationPipe over the contract schemas; a
 * failure is a 400 problem naming the member, before the handler runs.
 */
@Controller('catalog/brands')
export class BrandsController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  @ApiZodResponse(200, BrandListResponseSchema)
  @ApiZodResponse(400, ProblemDetailsSchema)
  list(@Query({ schema: BrandListQuerySchema }) query: BrandListQuery): Promise<BrandListResponse> {
    return this.brands.list(query)
  }

  @Get(':slug')
  @ApiZodResponse(200, BrandSchema)
  @ApiZodResponse(400, ProblemDetailsSchema)
  @ApiZodResponse(404, ProblemDetailsSchema)
  async get(@Param('slug', { schema: slug }) brandSlug: string): Promise<Brand> {
    return toDto(await this.brands.getBySlug(brandSlug))
  }
}
```

- [ ] **Step 4: Write the module and its barrel**

`apps/api/src/modules/catalog/catalog.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { OutboxModule } from '../../infra/outbox/index.js'
import { BrandsController } from './api/brands.controller.js'
import { BrandCreatedLogger } from './application/brand-created.logger.js'
import { BrandRepository } from './application/brand.repository.js'
import { BrandService } from './application/brand.service.js'
import { DrizzleBrandRepository } from './infrastructure/brand.repository.js'

/**
 * The only file that wires ports to adapters (§5.3). OutboxModule is not
 * global, so it is imported here for EventPublisher; DbModule is, so DRIZZLE
 * needs no import. BrandCreatedLogger is a provider so the relay's discovery
 * scan finds its @OnDomainEvent method.
 */
@Module({
  imports: [OutboxModule],
  controllers: [BrandsController],
  providers: [
    BrandService,
    BrandCreatedLogger,
    { provide: BrandRepository, useClass: DrizzleBrandRepository },
  ],
  exports: [BrandService],
})
export class CatalogModule {}
```

`apps/api/src/modules/catalog/index.ts`:

```ts
// The only path another module or an entrypoint may import (§5.3).
export { CatalogModule } from './catalog.module.js'
export { BrandService } from './application/brand.service.js'
// For a cross-module foreign key only (db.md): declare, never query.
export * as tables from './infrastructure/schema.js'
```

- [ ] **Step 5: Register the module**

In `apps/api/src/app.module.ts`, add the import line after the `StorageModule` import:

```ts
import { CatalogModule } from './modules/catalog/index.js'
```

and add `CatalogModule,` to the `imports` array after `HealthModule,`, with the comment:

```ts
    // The first bounded context (§5.7). Its repository holds the pool's
    // token and opens nothing at boot, so src/openapi.ts still boots dry.
    CatalogModule,
```

- [ ] **Step 6: Run the HTTP test to verify it passes**

Run: `pnpm test:integration --filter=api`
Expected: the seven new tests PASS; `openapi.test.ts`'s "matches the committed openapi.json" now FAILS — the committed document lacks the two routes. That failure is the freshness gate doing its job; the next step clears it.

- [ ] **Step 7: Regenerate the document and the client schema**

Run: `pnpm openapi:generate`
Expected: `apps/api/openapi.json` gains `/catalog/brands` and `/catalog/brands/{slug}`; `packages/api-client/src/generated/schema.d.ts` gains both paths with `Brand`-shaped responses.

- [ ] **Step 8: Check how the named schemas were rendered (deviation 10)**

Run: `node -e "const d=require('./apps/api/openapi.json');console.log(Object.keys(d.components?.schemas??{}));console.log(JSON.stringify(d.paths['/catalog/brands/{slug}'].get.responses['200'].content['application/json'].schema).slice(0,200))"`

- If `components.schemas` lists `Brand` and `BrandListResponse`, and the response schema is a `$ref` to them: keep the ids. Record it.
- If the response schema is inline and `components.schemas` is empty: harmless; keep the ids, record it.
- If the document contains `$defs` anywhere (`grep -c '"\$defs"' apps/api/openapi.json` is not 0): OpenAPI 3.0 tooling does not read them. Remove the two `.meta({ id: … })` calls in `packages/contracts/src/catalog/brand.ts`, delete the "names itself" test in `brand.test.ts`, run `pnpm openapi:generate` again, and record the removal in the task report.

- [ ] **Step 9: Extend the client test with a path parameter**

Append to `packages/api-client/src/index.test.ts`, inside `describe('createApiClient', …)`:

```ts
it('substitutes a path parameter and returns a typed brand', async () => {
  const brand = {
    id: '0199f3c0-1111-7000-8000-000000000000',
    slug: 'muscletech',
    name: 'ماسل‌تک',
    createdAt: '2026-09-25T12:00:00.000Z',
    updatedAt: '2026-09-25T12:00:00.000Z',
  }
  const { fetch, calls } = fakeFetch(200, brand)
  const api = createApiClient({ baseUrl: BASE, fetch })
  const { data } = await api.GET('/catalog/brands/{slug}', {
    params: { path: { slug: 'muscletech' } },
  })
  expect(data?.name).toBe('ماسل‌تک')
  expect(calls[0]?.url).toBe('http://api.internal:3001/catalog/brands/muscletech')
})

it('turns the catalog 404 into an ApiError the storefront can branch on', async () => {
  const problem = {
    type: 'urn:problem:CATALOG_BRAND_NOT_FOUND',
    title: 'Brand Not Found',
    status: 404,
    instance: 'req-2',
    code: 'CATALOG_BRAND_NOT_FOUND',
    detail: 'No brand has the slug "nope"',
  }
  const { fetch } = fakeFetch(404, problem, 'application/problem+json')
  const api = createApiClient({ baseUrl: BASE, fetch })
  await expect(
    api.GET('/catalog/brands/{slug}', { params: { path: { slug: 'nope' } } }),
  ).rejects.toMatchObject({ code: 'CATALOG_BRAND_NOT_FOUND', status: 404 })
})
```

Run: `pnpm test --filter=@ds/api-client`
Expected: PASS, eight tests — `data?.name` typechecks only because the regenerated `paths` carry the route.

- [ ] **Step 10: Verify and commit**

Run: `pnpm check`
Expected: green — `openapi.test.ts` matches the regenerated document; `boundaries` accepts `api → application` and the module file's `→ infrastructure`; `budget` (web) is untouched.

```bash
git add apps/api/src/modules/catalog apps/api/src/app.module.ts apps/api/test/integration/catalog-http.test.ts apps/api/openapi.json packages/api-client/src/generated/schema.d.ts packages/api-client/src/index.test.ts
git commit -m "feat(api): serve GET /catalog/brands and /catalog/brands/:slug"
```

---

## Task 8: The seed — the store's nine brands through the service, idempotent

Spec §5.7 (Seed), §4.2 and §4.4 (`db:seed`, `api#seed`, `seed: node dist/seed.js`), §14 step 5. Deviations 6 and 11. Review Focus 3.

**Files:**

- Create: `apps/api/src/modules/catalog/application/seed-brands.ts`, `apps/api/src/seed.ts`
- Modify: `apps/api/src/modules/catalog/index.ts`, `apps/api/package.json`, `turbo.json`, root `package.json`, `docs/superpowers/specs/2026-08-27-foundation-design.md` (§5.7, §7.9, §14 — the seed's content, Step 7)
- Test: `apps/api/test/integration/seed.test.ts`

**Interfaces:**

- Consumes: `BrandService` (Task 4); `CatalogModule`; `OutboxRelay`, `outboxEvents`.
- Produces: `SEED_BRANDS: readonly CreateBrandInput[]` (nine, with descriptions); `seedBrands(brands: BrandService): Promise<SeedReport>` with `type SeedReport = { created: string[]; skipped: string[] }` (slugs); the entrypoint `dist/seed.js`; the scripts `pnpm db:seed` → `turbo run seed --filter=api` → `api#seed` → `node dist/seed.js`.

- [ ] **Step 1: Write the failing test**

`apps/api/test/integration/seed.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { Db } from '../../src/infra/db/index.js'
import { OutboxRelay } from '../../src/infra/outbox/index.js'
import {
  BrandService,
  CatalogModule,
  SEED_BRANDS,
  seedBrands,
} from '../../src/modules/catalog/index.js'
import { withDb, type DbFixture } from '../setup/fixture.js'

describe('seedBrands', () => {
  let fixture: DbFixture
  let db: Db
  let brands: BrandService
  let relay: OutboxRelay

  beforeAll(async () => {
    fixture = await withDb(CatalogModule)
    db = fixture.db
    brands = fixture.app.get(BrandService)
    relay = fixture.app.get(OutboxRelay)
  })

  afterAll(async () => {
    await fixture?.close()
  })

  beforeEach(async () => {
    await fixture.reset()
  })

  async function counts(): Promise<{ brands: number; events: number }> {
    const res = await db.execute(
      sql`select (select count(*)::int from brands) as brands, (select count(*)::int from outbox_events where event_type = 'catalog.brand.created') as events`,
    )
    return res.rows[0] as { brands: number; events: number }
  }

  it('creates the nine brands with their descriptions, once', async () => {
    const report = await seedBrands(brands)
    expect(report.created).toHaveLength(9)
    expect(report.skipped).toEqual([])
    expect(await counts()).toEqual({ brands: 9, events: 9 })
    const nutriversum = await brands.findBySlug('nutriversum')
    expect(nutriversum?.name).toBe('نوتری‌ورسوم')
    expect(nutriversum?.description).toMatch(/^آمینو/)
    // Normalised on write: the fixture's Persian digits are stored as ASCII.
    expect((await brands.findBySlug('7nutrition'))?.description).toContain('100')
  })

  it('writes nothing and emits nothing on a second run', async () => {
    await seedBrands(brands)
    const second = await seedBrands(brands)
    expect(second.created).toEqual([])
    expect(second.skipped).toHaveLength(9)
    expect(await counts()).toEqual({ brands: 9, events: 9 })
  })

  // Review Focus 3: a crashed seed left three rows; the next run fills the gap, once.
  it('completes a partial seed without duplicating rows or events', async () => {
    for (const input of SEED_BRANDS.slice(0, 3)) await brands.create(input)
    const report = await seedBrands(brands)
    expect(report.created).toEqual(SEED_BRANDS.slice(3).map((b) => b.slug))
    expect(report.skipped).toEqual(SEED_BRANDS.slice(0, 3).map((b) => b.slug))
    expect(await counts()).toEqual({ brands: 9, events: 9 })
    const perSlug = await db.execute(
      sql`select payload->>'slug' as slug, count(*)::int as n from outbox_events group by 1 order by 1`,
    )
    expect(perSlug.rows).toHaveLength(9)
    expect(perSlug.rows.every((row) => (row as { n: number }).n === 1)).toBe(true)
  })

  it('delivers every event to the logging handler through the relay', async () => {
    await seedBrands(brands)
    await relay.runOnce()
    const res = await db.execute(
      sql`select count(*) filter (where published_at is null)::int as pending, count(*) filter (where last_error is not null)::int as failed from outbox_events`,
    )
    expect(res.rows[0]).toEqual({ pending: 0, failed: 0 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration --filter=api`
Expected: FAIL — `SEED_BRANDS` and `seedBrands` are not exported from the barrel.

- [ ] **Step 3: Write the fixtures and the function**

`apps/api/src/modules/catalog/application/seed-brands.ts`:

```ts
import { Logger } from '@nestjs/common'
import type { CreateBrandInput } from '../domain/brand.js'
import type { BrandService } from './brand.service.js'

/**
 * The store's nine brands, read from the labels on Saman's shelf on
 * 2026-09-25 (foundation §5.7 as amended that day; Deviation 11) — one with
 * a ZWNJ on purpose — each with the one-line description the storefront's
 * brand card shows (3c). Persian here is data, not copy: the API still
 * speaks English. The entity normalises on write, so «۱۰۰» is stored as
 * `100` and displayed Persian. Every spelling but «بلک اسکال» (Saman's) is a
 * transliteration he may correct here — data, not a migration.
 */
export const SEED_BRANDS: readonly CreateBrandInput[] = [
  {
    slug: 'black-skull',
    name: 'بلک اسکال',
    description:
      'برند برزیلی مکمل‌های ورزشی؛ وی ایزوله و وی اچ‌دی، گلوتامین، بتاآلانین، زد‌ام‌ای و کروم پیکولینات.',
  },
  {
    slug: 'nutriversum',
    name: 'نوتری‌ورسوم',
    description: 'آمینو انرژی با طعم بلک‌کارنت؛ ۲۷۰ گرم، ۴۵ سروینگ.',
  },
  {
    slug: 'applied-nutrition',
    name: 'اپلاید نوتریشن',
    description: 'برند بریتانیایی؛ اچ‌ام‌بی ۵۰۰ میلی‌گرمی، ۱۲۰ کپسول.',
  },
  {
    slug: 'aavelone-pharma',
    name: 'آولون فارما',
    description: 'تست بوستر ۳۲۰۰؛ ۱۲۰ کپسول، هر سروینگ چهار کپسول.',
  },
  {
    slug: 'belissima',
    name: 'بلیسیما',
    description: 'تغذیهٔ زیبایی؛ کلاژن پلاس با هیالورونیک اسید و بیوتین، طعم توت‌فرنگی، ۲۶۴ گرم.',
  },
  {
    slug: 'labrada',
    name: 'لابرادا',
    description: 'برند آمریکایی؛ کریالین، کراتین مونوهیدرات خالص، ۲۵۰ گرم، ۵۰ سروینگ.',
  },
  {
    slug: 'galvanize',
    name: 'گالوانایز',
    description: 'ای‌ای‌ای زیرو با طعم گیلاس؛ آمینواسیدهای ضروری برای عملکرد و ریکاوری.',
  },
  {
    slug: 'nutrex',
    name: 'نوترکس',
    description: 'برند آمریکایی؛ ال‌کارنیتین مایع ۳۰۰۰ برای رژیم و انرژی تمرین.',
  },
  {
    slug: '7nutrition',
    name: 'سون نوتریشن',
    description: 'ساخت لهستان؛ سی‌ال‌ای ۱۰۰۰، ۱۰۰ سافت‌ژل ۱۰۰۰ میلی‌گرمی.',
  },
]

export type SeedReport = { readonly created: string[]; readonly skipped: string[] }

/**
 * Idempotent at the application level (§5.7): a slug that exists is skipped,
 * so a second run writes no row and emits no event, and a run after a crash
 * fills only the gap. Every write goes through the service — the seed never
 * issues a raw insert.
 */
export async function seedBrands(brands: BrandService): Promise<SeedReport> {
  const logger = new Logger('seed')
  const created: string[] = []
  const skipped: string[] = []
  for (const input of SEED_BRANDS) {
    if ((await brands.findBySlug(input.slug)) !== null) {
      skipped.push(input.slug)
      continue
    }
    await brands.create(input)
    created.push(input.slug)
    logger.log({ msg: 'brand seeded', slug: input.slug })
  }
  return { created, skipped }
}
```

Extend `apps/api/src/modules/catalog/index.ts`:

```ts
export { SEED_BRANDS, seedBrands, type SeedReport } from './application/seed-brands.js'
```

- [ ] **Step 4: Write the entrypoint and the scripts**

`apps/api/src/seed.ts`:

```ts
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import { BrandService, seedBrands } from './modules/catalog/index.js'

/**
 * `node dist/seed.js` (foundation §4.4, §5.7): the module graph main.ts
 * boots, no HTTP server, the relay not started — the outbox rows wait for
 * the API or the worker. Reads apps/api/.env through ConfigModule, so it
 * runs from apps/api, which `pnpm db:seed` guarantees through turbo.
 */
const context = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true })
const logger = context.get(Logger)
context.useLogger(logger)
try {
  const report = await seedBrands(context.get(BrandService))
  logger.log({ msg: 'seed finished', created: report.created, skipped: report.skipped })
} catch (error) {
  logger.error({ err: error, msg: 'seed failed' })
  process.exitCode = 1
} finally {
  await context.close()
}
```

`apps/api/package.json` — add to `scripts`, after `"openapi"`:

```json
    "seed": "node dist/seed.js",
```

`turbo.json` — add after the `"api#openapi"` task (strict JSON, no comments):

```json
    "api#seed": {
      "dependsOn": ["build"],
      "cache": false,
      "env": [
        "NODE_ENV",
        "PROCESS_ROLE",
        "PORT",
        "LOG_LEVEL",
        "DATABASE_URL",
        "DATABASE_POOL_MAX",
        "REDIS_URL",
        "S3_ENDPOINT",
        "S3_REGION",
        "S3_BUCKET",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "S3_FORCE_PATH_STYLE",
        "CORS_ORIGINS",
        "TRUST_PROXY",
        "OUTBOX_POLL_MS",
        "OPENAPI_UI_ENABLED"
      ]
    },
```

Root `package.json` — add after `"db:migrate"`:

```json
    "db:seed": "turbo run seed --filter=api --output-logs=errors-only",
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:integration --filter=api`
Expected: PASS, four seed tests.

- [ ] **Step 6: Run the real thing twice**

Run: `pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm db:seed`
Expected: the first run logs nine `brand seeded` lines and `seed finished` with nine created; the second logs `seed finished` with nine skipped and no `brand seeded` line. Exit code 0 both times.

- [ ] **Step 7: Amend the foundation spec — the seed's content (Deviation 11)**

`docs/superpowers/specs/2026-08-27-foundation-design.md`, four edits in the spec's own amendment style: a sentence appended to the end of an existing bullet or numbered item, after one space, opening with `**Amended 2026-09-25**`. Find each anchor with `grep -n`; the anchors are the opening words below. Nothing else in the file changes.

1. §5.7 — the bullet opening `- **Seed** (` gains, at its end:

   ```markdown
   **Amended 2026-09-25** (3b plan, Task 8; 3c spec D29): the seed is the store's own brands, read from Saman's shelf — nine of them, in `fa` order: `aavelone-pharma` «آولون فارما», `applied-nutrition` «اپلاید نوتریشن», `black-skull` «بلک اسکال», `belissima` «بلیسیما», `7nutrition` «سون نوتریشن», `galvanize` «گالوانایز», `labrada` «لابرادا», `nutrex` «نوترکس», `nutriversum` «نوتری‌ورسوم» (the one name with a ZWNJ) — each with a one-line Persian `description`. The six brands above stay as test data in the catalog suites; the idempotence rule is unchanged.
   ```

2. §7.9 — the bullet opening `- Playwright (` gains, at its end:

   ```markdown
   **Amended 2026-09-25** (3b plan, Task 8): with the real seed, `/brands` lists the nine seeded names and the ZWNJ route is `/brands/nutriversum` («نوتری‌ورسوم»).
   ```

3. §14 — the numbered item opening ``5. `pnpm db:seed` inserts the six brands`` gains, at its end:

   ```markdown
   **Amended 2026-09-25** (3b plan, Task 8): nine brands, §5.7.
   ```

4. §14 — the numbered item opening `` 1. `pnpm install`, `pnpm db:up` `` gains, at its end:

   ```markdown
   **Amended 2026-09-25** (3b plan, Task 8): the nine seeded names; `/brands/nutriversum` renders «نوتری‌ورسوم».
   ```

Run: `node_modules/.bin/prettier --write docs/superpowers/specs/2026-08-27-foundation-design.md`
Then run, on its own line and never piped: `pnpm check:docs`
Expected: `check-docs: OK`.

- [ ] **Step 8: Verify and commit**

Run: `pnpm check`
Expected: green — `boundaries.test.ts` still parses `turbo.json`; `src/seed.ts` classifies as an entrypoint and imports only the barrel; the docs check accepts the amended spec.

```bash
git add apps/api/src/modules/catalog/application/seed-brands.ts apps/api/src/modules/catalog/index.ts apps/api/src/seed.ts apps/api/test/integration/seed.test.ts apps/api/package.json turbo.json package.json docs/superpowers/specs/2026-08-27-foundation-design.md
git commit -m "feat(api): seed the store's nine brands through BrandService, idempotently"
```

---

## Task 9: The `openapi` CI job and the documents the spec owes

Spec §10.1 (the job), §12.1 (`apps/api/CLAUDE.md`, `packages/contracts/CLAUDE.md`, ≤ 60 lines each, pointing at the reference slice), `generated.md`, `docs.md` (a new term means a glossary row — none is introduced: `Brand` is already there), the 3a spec's Status and Next-step rows.

**Files:**

- Modify: `.github/workflows/ci.yml`, `scripts/check-docs.manifest`, `README.md`, `.claude/skills/new-api-module/SKILL.md`, `docs/superpowers/specs/2026-09-25-storefront-design-system-design.md` (Next step row), `docs/superpowers/specs/2026-08-27-foundation-design.md` (Status row)
- Create: `apps/api/CLAUDE.md`, `packages/contracts/CLAUDE.md`

- [ ] **Step 1: Add the `openapi` job**

In `.github/workflows/ci.yml`, add after the `e2e` job and before `authors`:

```yaml
openapi:
  if: github.event_name != 'schedule'
  timeout-minutes: 15
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
      with:
        fetch-depth: 0
    - uses: pnpm/action-setup@v6
    - uses: actions/setup-node@v5
      with:
        node-version-file: .node-version
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    # src/openapi.ts boots AppModule without listening and needs a
    # schema-valid environment, not a live store (§5.5, §10.1); the example
    # holds the local values and no secret.
    - run: cp apps/api/.env.example apps/api/.env
    - run: pnpm openapi:generate
    # A diff means a contract or a route changed without regenerating:
    # generated.md's rule, enforced. Both paths are prettier-ignored, so
    # formatting cannot manufacture a diff.
    - run: git diff --exit-code -- apps/api/openapi.json packages/api-client/src/generated
```

- [ ] **Step 2: Write `apps/api/CLAUDE.md`**

```markdown
# apps/api — the API

NestJS 12 ESM on Fastify, Zod contracts from `@ds/contracts`, Drizzle over
Postgres 16, Redis, RustFS. English only: Persian appears here only as data
in the seed. Rules: `.claude/rules/api.md`, `db.md`, `persian.md`,
`testing.md`. Design: `docs/superpowers/specs/2026-08-27-foundation-design.md` §5–§6.

## Commands (from the repository root)

| Command                              | Does                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `pnpm db:up` · `pnpm db:migrate`     | the four services; apply `drizzle/*.sql` under an advisory lock    |
| `pnpm db:generate --name=<name>`     | the next migration from `src/**/schema.ts`; commit the SQL         |
| `pnpm db:seed`                       | the nine brands through `BrandService`, idempotent by slug         |
| `pnpm openapi:generate`              | build, write `openapi.json`, regenerate the client's `schema.d.ts` |
| `pnpm test --filter=api`             | unit — no store                                                    |
| `pnpm test:integration --filter=api` | Testcontainers — needs Docker                                      |
| `pnpm check`                         | everything, `boundaries` and the openapi freshness test included   |

`cp apps/api/.env.example apps/api/.env` once; never read it back.

## Where things live

- `src/infra/*` — config, logger, db (`DRIZZLE`, `Db`), redis, storage,
  outbox (`EventPublisher`, `@OnDomainEvent`, `OutboxRelay`), health, http
  (the validation pipe, `ProblemFilter`, throttle, security). Each is a
  barrel: import `infra/<x>/index.js`, never deeper.
- `src/shared/*` — `errors` (`AppError` and its subclasses), `openapi`
  (`ApiZodResponse`, `buildDocument`), `ids` (`newId()`, UUIDv7). Barrels too.
- `src/modules/catalog/` — the template every context copies
  (`new-api-module`): `index.ts` (the only import path), `catalog.module.ts`
  (ports → adapters), `api/` (controllers), `application/` (services, ports,
  handlers, seed fixtures), `domain/` (pure: entities, events),
  `infrastructure/` (`schema.ts`, repositories).
- `src/main.ts` (HTTP), `worker.ts` (relay only), `openapi.ts` (the
  document), `seed.ts`, `migrate.ts` (no Nest; runs under tsx).
- `test/integration/<topic>.test.ts` on `withDb()` (`test/setup/fixture.ts`);
  `test/boundaries.test.ts` pins the layering rules by name.

## What fails `pnpm check`

- A `domain/` file importing `@nestjs/*`, `drizzle-orm`, `pg` or `ioredis`;
  an `application/` file importing `infrastructure/`; a file importing
  another module below its `index.ts`; a deep import into `infra/*`/`shared/*`.
- A route or schema changed without `pnpm openapi:generate`: the committed
  `openapi.json` is compared with the booted app.
- Anything that opens a Postgres or Redis connection while `AppModule` boots.
- `ValidationPipe`, DTO classes, `class-validator`, `@nestjs/event-emitter`,
  `@nestjs/platform-express`, `__dirname`, a relative import without `.js`.
- A comment in `turbo.json`.

## The shape of a route and a write

`@Controller('catalog/brands')` → `@Get(':slug')` with
`@Param('slug', { schema: slug })` and `@ApiZodResponse(200, BrandSchema)`;
the service throws `NotFoundError('CATALOG_BRAND_NOT_FOUND', '<English>')`
and `ProblemFilter` answers `application/problem+json`. A write runs in
`db.transaction(async (tx) => …)`, passes `tx` to the repository and to
`EventPublisher.publish(event, tx)`, and never touches another module's tables.
```

- [ ] **Step 3: Write `packages/contracts/CLAUDE.md`**

```markdown
# packages/contracts — the HTTP shapes

Zod 4 schemas for what crosses HTTP: queries, params, bodies, response
envelopes, the problem contract. Never a domain entity
(`.claude/rules/contracts.md`). Consumed by `apps/api` (validation, OpenAPI),
`@ds/api-client` (types only) and `apps/web` (types and parsing).

## Layout

- `src/common/` — `id` (`z.uuid()`), `slug`, `persianText(max)` (normalises
  through `@ds/persian`, then `.min(1).max(max)` in code points),
  `PageQuerySchema`, `paginated(item)`.
- `src/errors/` — `ERROR_CODES`, `ErrorCode`, `ProblemDetailsSchema` (RFC 9457).
- `src/catalog/brand.ts` — `BrandSchema`, `BrandListQuerySchema`,
  `BrandListResponseSchema` and their types: the template for every context.
- `src/index.ts` re-exports everything; a new file is added there.

## Rules that bite

- Top-level forms: `z.uuid()`, `z.iso.datetime()`, `z.email()`.
- `z.iso.datetime()` requires seconds: emit `Date#toISOString()`, and pin it
  in the schema's test.
- `.min()`/`.max()` count code points — a ZWNJ costs one.
- A new `ErrorCode` needs its title in `apps/api`'s `TITLE_BY_CODE`, its
  Persian sentence in `apps/web/lib/errors.ts`, and `errors.test.ts` updated.
- `.meta({ id: 'Name' })` on a response schema names it in the OpenAPI
  document and the generated client.
- Every schema has a colocated `*.test.ts`: the accepted shape, each
  rejection, and normalisation through `persianText`.

## Commands

`pnpm test --filter=@ds/contracts` · `pnpm build --filter=@ds/contracts`
(consumers import `dist/`; turbo builds it for `pnpm check`) ·
`pnpm openapi:generate` after changing a schema a route uses.
```

- [ ] **Step 4: The manifest, the README, the skill, the spec rows**

Append to `scripts/check-docs.manifest`:

```
apps/api/CLAUDE.md
packages/contracts/CLAUDE.md
```

`README.md`: run `grep -n "Phase 3b" README.md` and edit both hits — the status paragraph's "the catalogue arrives with Phase 3b and the brand pages with 3c" becomes "the catalogue's Brand slice (3b) is built; the brand pages arrive with 3c", and "there is nothing to seed until Phase 3b" becomes "`pnpm db:seed` inserts the store's nine brands".

`.claude/skills/new-api-module/SKILL.md`: replace the blockquote

```markdown
> **Phase 2 onward.** This skill copies the `catalog` module, which does not
> exist until the reference slice is built. Until then it has nothing to copy.
```

with

```markdown
> The `catalog` module (Phase 3b, 2026-09) is the template this skill copies:
> `apps/api/src/modules/catalog/`. Its `index.ts`, `catalog.module.ts`,
> `api/`, `application/`, `domain/` and `infrastructure/` are the anatomy.
```

`docs/superpowers/specs/2026-09-25-storefront-design-system-design.md`, the `**Next step**` row: replace `then 3b` with `3b built (\`docs/superpowers/plans/2026-09-25-brand-slice.md\`); then 3c`.

`docs/superpowers/specs/2026-08-27-foundation-design.md`, the `**Status**` row: after the text that names the 3a sub-phase, append `; 3b built per \`docs/superpowers/plans/2026-09-25-brand-slice.md\` (2026-09)`. Keep every existing link.

- [ ] **Step 5: Verify and commit**

Run: `pnpm check`
Expected: green — `check:docs` accepts both `CLAUDE.md` files under 60 lines and every relative link resolves case-exactly.

```bash
git add .github/workflows/ci.yml apps/api/CLAUDE.md packages/contracts/CLAUDE.md scripts/check-docs.manifest README.md .claude/skills/new-api-module/SKILL.md docs/superpowers/specs/2026-09-25-storefront-design-system-design.md docs/superpowers/specs/2026-08-27-foundation-design.md
git commit -m "ci: add the openapi freshness job and record the Brand slice in the documents"
```

---

## Task 10: Completion — the whole slice, end to end, and the pull request

Spec §14 (the end-to-end flow), §10.1, ADR-0018 (one rebase-merge PR per phase), ADR-0013 (a check is promoted to required only after it has reported green on a real pull request).

- [ ] **Step 1: The full gate**

Run: `pnpm check && pnpm audit:authors`
Expected: green; only Saman as an author.

- [ ] **Step 2: The flow of §14, on a running API**

Run: `pnpm db:up && pnpm db:migrate && pnpm db:seed`
Then, in the background: `pnpm dev` (the API on 3001 reads `apps/api/.env`; the web app on 3000 is irrelevant here). Wait for `GET /health/ready` to answer 200:

```bash
node -e "fetch('http://localhost:3001/health/ready').then(r=>console.log(r.status))"
```

Then:

```bash
node -e "fetch('http://localhost:3001/catalog/brands').then(r=>r.json()).then(j=>console.log(j.total, j.items.map(b=>b.name).join(' | ')))"
node -e "fetch('http://localhost:3001/catalog/brands/nutriversum').then(r=>r.json()).then(j=>console.log(j.name.includes('‌'), j.description))"
node -e "fetch('http://localhost:3001/catalog/brands/no-such-brand').then(async r=>console.log(r.status, r.headers.get('content-type'), (await r.json()).code))"
```

Expected: `9 آولون فارما | اپلاید نوتریشن | بلک اسکال | بلیسیما | سون نوتریشن | گالوانایز | لابرادا | نوترکس | نوتری‌ورسوم`; `true` and the description; `404 application/problem+json CATALOG_BRAND_NOT_FOUND`. With `PROCESS_ROLE=all` in `.env`, the running API's relay also drains the nine outbox rows and logs nine `brand created` lines — quote one in the task report. Stop the dev server.

- [ ] **Step 3: The pull request**

Run: `git push -u origin feat/brand-slice` (asks), then:

```bash
gh pr create --base main --head feat/brand-slice --title "feat(api): the Brand slice through the API (3b)" --body-file - <<'PR_BODY'
## What and why

Phase 3b (foundation spec §5.7, §8, §14; 3a spec §1): the `catalog` context's Brand aggregate end to end on the API side — contracts, the Nest module with its migration, seed and outbox event, `@ds/api-client`, and the `openapi` CI job. Plan: `docs/superpowers/plans/2026-09-25-brand-slice.md`.

## Checklist

- [x] Spec section or plan task linked above
- [x] Tests added, and each one was watched failing before the code existed
- [x] `pnpm check` is green locally
- [x] No AI attribution in any commit (`pnpm audit:authors`)
- [x] Glossary updated if a term was introduced; ADR written if a decision was made — none introduced, none made
PR_BODY
```

Expected: the `check`, `e2e`, `openapi`, `authors` and `secrets` jobs run on the PR.

- [ ] **Step 4: Promote the new check (Saman)**

Once `openapi` has reported green on this pull request, Saman adds it to the ruleset's required status checks (GitHub → Settings → Rules → the `main` ruleset → Require status checks to pass), in the ADR-0013 sequence. Then one rebase-merge, `feat/brand-slice` → `main`.

---

## Phase 3b completion

The phase is done when all of the following hold:

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm db:seed   # second run: nine skipped, nothing written
pnpm check                                                     # unit, integration, boundaries, the openapi freshness test, sherif, docs, format
pnpm openapi:generate && git diff --exit-code -- apps/api/openapi.json packages/api-client/src/generated
pnpm audit:authors
```

and a running API answers `GET /catalog/brands` with the nine names in `fa` order, `GET /catalog/brands/nutriversum` with the ZWNJ intact, and `GET /catalog/brands/no-such-brand` with a `404` problem `CATALOG_BRAND_NOT_FOUND`. The `openapi` job is green on the pull request and then required.

**Deliberately not in 3b**, each with its owner: `requestApi()` and header forwarding beyond default headers (the identity spec); `Money` (the first priced aggregate); the four Iranian-format refinements (identity and customers); a search route — `search_text` is indexed and unused until the products slice queries it; any write route; images or logos on a brand (the media spec); `packages/contracts/src/catalog/product.ts` (the products spec).

**Recorded for 3c:** `publicApi` reads `API_INTERNAL_URL` itself on first use, so `apps/web/lib/env.ts`'s `getServerEnv()` still has no caller — 3c decides whether it stays for `requestApi()` or goes; the `e2e` job gains Postgres, Redis, the API server and `pnpm db:seed` after `pnpm db:migrate`; the brand tile's body is the seed's `description`, which Saman may reword in `seed-brands.ts` — a change there is data, not a migration.
