# Dubai Supplement — Foundation Design

| | |
|---|---|
| **Date** | 2026-08-27 |
| **Status** | Approved in brainstorming (sections 1–5) by Saman Hoseinpour; awaiting final read before the implementation plan |
| **Owner** | Saman Hoseinpour (solo developer, working with Claude Code) |
| **Inputs** | `docs/research/2026-08-27-foundation-research.md`, `docs/research/2026-08-27-liara-verification.md` |
| **Next step** | `docs/superpowers/plans/` implementation plan via the writing-plans skill |

## 1. Purpose and scope

Build the **foundation** of "Dubai Supplement" (working name), a Persian-language (fa-IR, right-to-left) e-commerce web application for gym and fitness supplements: the repository, toolchain, architecture skeleton, quality gates, deployment pipeline, documentation system, and agent-development workflow — plus one thin **reference slice** that proves every seam works end to end.

This spec deliberately contains **no product features**. Products, cart, checkout, authentication, admin, media, search and payments are each future specs. The foundation exists so that those specs can be implemented by AI agents quickly, consistently, and safely.

## 2. Decisions already made (do not re-open without an ADR)

| # | Decision | Consequence |
|---|---|---|
| D1 | Customers **and** the business are inside Iran ("Scenario A") | Production hosting inside Iran; Iranian gateway + enamad later; phone-OTP login later; `.ir` primary domain; Vercel/Neon/Stripe/Cloudflare-proxy are **not** in the production path |
| D2 | **Single store**, own inventory, one seller, one warehouse to start | No Seller/Channel concept; Inventory is its own module so multi-warehouse can come later |
| D3 | **Persian only, permanently** | No i18n library; plain text columns; `<html lang="fa" dir="rtl">` hard-coded |
| D4 | **No online payment for now** — checkout ends in a WhatsApp handoff (logic to be specified later) | Payments is a *planned* bounded context with a clean seam; nothing wired |
| D5 | No domain, no enamad, no hosting account yet | Registrar and hosting recommendations are part of this spec; purchases are Saman's manual steps |
| D6 | **Approach 3 ("Hybrid")** | NestJS 12 ESM (spike-gated), Drizzle, pnpm + Turborepo, Docker via OrbStack, Vitest, ESLint 10, Liara + ArvanCloud |
| D7 | GitHub repository is **public** | Rulesets/branch protection available on GitHub Free; secrets hygiene is mandatory from the first commit |

## 3. Constraints

- **Stack is fixed:** NestJS on the Fastify adapter (API), Next.js App Router (storefront), TypeScript everywhere, PostgreSQL, Redis.
- **Iran network reality:** Shaparak gateways accept only Iranian IPs ("Iran Access"); half-price domestic traffic (ترافیک نیم‌بها) requires an Iranian data centre and ito.gov.ir registration; after the 2026 shutdown the network is allowlist-shaped. Therefore: everything the customer touches is hosted inside Iran; **nothing is fetched from foreign hosts at request time** (fonts, scripts, images all self-hosted); images are built in CI, not on the server.
- **Ecosystem timing (as of 2026-08-27):** NestJS 12.0.1 (pure ESM) shipped today; TypeScript 7.0 has no compiler API and breaks `nest build` → **TypeScript stays on 6.0.x**; `prisma@latest` is an 8.0 RC (irrelevant — we use Drizzle); Drizzle 1.0 is still beta → **Drizzle 0.45.x**; Node 24 is the current LTS. **Every dependency is exact-pinned**; Renovate proposes upgrades.
- **Liara limits (verified):** managed PostgreSQL tops out at **16.3**, Redis at **7.2** (no Valkey); no horizontal scaling; Docker platform required for a pnpm monorepo; private container registries unsupported (Liara builds from the Dockerfile); `--port` must be passed explicitly in CI.
- **Solo developer + AI agents:** every pattern must be copyable, every rule must be enforced by a tool rather than by prose, and there must be one verification command (`pnpm check`).
- **Human-only authorship:** every commit and PR is authored by Saman Hoseinpour; no AI co-author trailers or "generated with" footers, ever.

## 4. Repository skeleton and toolchain

### 4.1 Layout

```
dubai-supplement/
├── apps/
│   ├── api/                 NestJS 12 ESM + Fastify — one image, two entrypoints (src/main.ts = HTTP, src/worker.ts = outbox relay / jobs)
│   ├── web/                 Next.js 16.3 storefront (fa, RTL) — output: standalone
│   └── admin/               reserved: README only, not scaffolded (separate Next.js app later, shares packages/)
├── packages/
│   ├── contracts/           Zod 4 schemas + inferred types — the single source of truth for HTTP shapes (compiled ESM + d.ts)
│   ├── api-client/          openapi-typescript types (committed under src/generated/) + openapi-fetch wrapper
│   ├── persian/             persian-tools wrappers, fa-IR Intl helpers (Toman, Persian digits, Jalali), normalizers, validators
│   ├── config-eslint/       shared ESLint 10 flat configs (base / nest / next)
│   └── config-typescript/   base.json · nestjs.json · nextjs.json · library.json
├── infra/
│   ├── compose.yaml         postgres:16 · redis:7.2 · rustfs (S3) · mailpit — local only
│   ├── docker/              Dockerfile.api · Dockerfile.web (multi-stage, turbo prune, repo-root context)
│   └── liara/               api.json · web.json (Liara app manifests)
├── docs/
│   ├── architecture/north-star.md   bounded contexts, dependency directions, invariants, non-goals — the only always-loaded doc
│   ├── decisions/                   ADRs, MADR minimal format, NNNN-title.md
│   ├── glossary.md                  Persian ↔ English domain vocabulary (the ubiquitous language)
│   ├── regulatory.md                enamad, Iran FDA supplements rule, TTAC, rial redenomination — facts and dates
│   ├── runbooks/                    iran-mirrors.md · go-live.md · first-deploy.md
│   ├── research/                    the 2026-08-27 research report and Liara verification
│   └── superpowers/{specs,plans}/   this spec and the plans that follow
├── .claude/                 settings.json · rules/ · hooks/ · agents/ · skills/
├── .github/                 workflows/ci.yml · workflows/deploy.yml · PULL_REQUEST_TEMPLATE.md · renovate.json
├── CLAUDE.md · AGENTS.md (one line → CLAUDE.md) · README.md
└── package.json · pnpm-workspace.yaml · turbo.json · lefthook.yml · commitlint.config.mjs · .node-version · .editorconfig · .gitattributes · .gitignore · .liaraignore
```

### 4.2 Toolchain and versions

Target versions were verified against the npm registry on 2026-08-27. The exact patch installed is pinned in the pnpm `catalog:` at implementation time and thereafter changed only by Renovate PRs.

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 24.x | Pinned via `devEngines.runtime` (`onFail: download`) and `.node-version`; no nvm/corepack |
| Language | TypeScript 6.0.x | TS 7 blocked by Renovate; tsconfigs written TS-7-clean (no `baseUrl`, no `paths`) |
| Package manager | pnpm 11.24.x | `packageManager` field; isolated `node_modules`; `catalog:` + `catalogMode: strict`; `allowBuilds` allowlist (`esbuild`, `@swc/core`, `sharp`, `lefthook`); `minimumReleaseAge` default 1440 min with `@nestjs/*` excluded while 12.0.x is < 24 h old |
| Task runner | Turborepo 2.10.x | `build` dependsOn `^build`; `dev` persistent/no cache; `envMode: strict`; remote cache **off** |
| Backend | NestJS 12.0.x, `@nestjs/platform-fastify` 12.0.x, Fastify 5.12.x, `@nestjs/cli` 12.0.x | ESM (`"type": "module"`, `nodenext`); SWC builder with `typeCheck: true`; fallback NestJS 11.2.x CJS if the spike fails (§5.1) |
| Validation | Zod 4.4.x, zod-openapi 6.0.x | Nest 12 native `StandardSchemaValidationPipe`; `@nestjs/swagger` 12 `standardSchemaConverter` |
| ORM | Drizzle ORM 0.45.x, drizzle-kit 0.31.x, `pg` 8.23.x | `casing: 'snake_case'`; SQL migrations committed |
| Database | PostgreSQL 16 | Liara ceiling; `pg_trgm`; ICU collation `fa` |
| Cache | Redis 7.2, ioredis 5.11.x | Throttler storage now; KV port for later |
| Object storage | `@aws-sdk/client-s3` 3.x | `forcePathStyle: true`; RustFS locally, Liara in prod |
| Frontend | Next.js 16.3.3+, React 19.2.x, Turbopack | `reactCompiler: true`, `cacheComponents: true`, `output: 'standalone'` |
| UI | Tailwind CSS 4.3.x, shadcn 4.19.x (`init --rtl -b base`), `@base-ui/react` 1.7.x, lucide-react | Logical utilities only |
| Font | Vazirmatn variable (SIL OFL), vendored | `next/font/local` |
| Persian utils | `@persian-tools/persian-tools` 4.0.x | Intl for formatting; date-fns-jalali only when arithmetic is needed (not at foundation) |
| Testing | Vitest 4.1.x, Testcontainers 12.1.x, `@playwright/test` 1.62.x, `@next/playwright`, `@axe-core/playwright` 4.13.x, Testing Library | One runner repo-wide |
| Lint/format | ESLint 10.9.x flat, typescript-eslint 8.68.x `strictTypeChecked`, eslint-config-next, eslint-plugin-boundaries 7.2.x, dependency-cruiser 18.2.x, Prettier 3.9.x + prettier-plugin-tailwindcss, sherif 1.13.x | |
| Git hooks | lefthook 2.1.x, `@commitlint/cli` + `config-conventional` 21.2.x | |
| Contracts → client | openapi-typescript 7.13.x, openapi-fetch 0.17.x | |
| IDs | UUIDv7 generated in application code (`uuid` package `v7()`) | PostgreSQL 16 has no native `uuidv7()` |

### 4.3 Dependency rules (enforced)

1. `apps/*` may depend on `packages/*`. Packages never depend on apps or on each other except: `api-client` → `contracts` (types only), `persian` has no workspace dependencies.
2. `packages/contracts` has exactly one runtime dependency: `zod`.
3. `packages/api-client` is generated from `apps/api/openapi.json`; the Turbo task graph is `api#openapi` → `api-client#generate` → `api-client#build`.
4. `apps/web` never imports from `apps/api` (not even types); it uses `contracts` and `api-client` only.
5. Enforcement: pnpm isolated `node_modules` (undeclared imports fail), `dependency-cruiser` in `apps/api` (module boundaries, §5.3), `eslint-plugin-boundaries` in both apps, `sherif` for cross-workspace version drift — all wired into `pnpm check`.

### 4.4 Root scripts

| Script | Does |
|---|---|
| `pnpm dev` | `turbo run dev` — contracts watch, api `nest start --watch`, web `next dev` |
| `pnpm db:up` / `pnpm db:down` | `docker compose -f infra/compose.yaml up -d` / `down` |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed` | drizzle-kit generate / apply migrations / idempotent seed (api workspace) |
| `pnpm openapi:generate` | api emits `openapi.json`; api-client regenerates `schema.d.ts` |
| `pnpm check` | `turbo run lint typecheck test boundaries --output-logs=errors-only` + `sherif` — **the** verification command |
| `pnpm check:affected` | same, `--affected` |
| `pnpm build` | `turbo run build` |
| `pnpm format` | prettier write |
| `pnpm audit:authors` | fails if any commit author/co-author is not Saman Hoseinpour or any AI trailer exists (§13.4) |

### 4.5 Deliberately not created (YAGNI)

`packages/ui` (shadcn lives in `apps/web` until an admin app exists), `packages/env` (each app validates its own env), Storybook, changesets, Nx, TanStack Query, next-intl, BullMQ (§5.6), a staging environment.

## 5. Backend architecture (`apps/api`)

### 5.1 Framework and the Nest 12 spike

NestJS 12 ESM on Fastify. Because 12.0.x is days old and several third-party packages still declare `<=11` peers (`@nestjs/terminus`, `@nestjs/throttler`, `nestjs-pino`), the **first implementation task is a time-boxed (≤ 1 hour) spike**: scaffold with `nest new --strict` choosing ESM, add the Fastify adapter, the peer overrides (`pnpm.peerDependencyRules.allowedVersions`), terminus, throttler and nestjs-pino, boot the app, and pass one `app.inject()` e2e test. **Go:** continue on 12. **No-go:** fall back to NestJS 11.2.x CJS + nestjs-zod with the *same* module anatomy and contracts — nothing else in this spec changes. The outcome is recorded in ADR-0001.

### 5.2 Process topology

One codebase, one Docker image, two entrypoints selected by `PROCESS_ROLE`:

- `api` → `src/main.ts`: Fastify HTTP server.
- `worker` → `src/worker.ts`: `NestFactory.createApplicationContext` (no HTTP) running the outbox relay and, later, queue consumers and cron.
- `all` → both in one process (launch configuration on Liara; §11.2).

Both entrypoints call `enableShutdownHooks()`; the relay loop stops on SIGTERM before the process exits.

### 5.3 Module anatomy and boundaries

Every bounded context has the same shape:

```
src/modules/<context>/
├── index.ts                 the ONLY import path other modules may use (public services, events, types)
├── <context>.module.ts      Nest wiring: ports → adapters
├── api/                     controllers; request/response shapes come from packages/contracts
├── application/             use-case services, ports (interfaces), transaction boundaries
├── domain/                  entities, value objects, domain events, domain errors — pure TypeScript
└── infrastructure/          Drizzle schema + repositories implementing the ports, external adapters
src/shared/                  Money value object, AppError hierarchy, pagination helpers, ids — imports nothing from modules/
src/infra/                   config, db, redis, storage, logger, health, outbox — imports nothing from modules/
```

`dependency-cruiser` rules (run in `pnpm check`, task `boundaries`):

| Rule | Meaning |
|---|---|
| `no-cross-module-internals` | `modules/A/**` may import `modules/B/index.ts` only |
| `domain-is-pure` | `domain/**` may not import `@nestjs/*`, `drizzle-orm`, `pg`, `ioredis`, or sibling layers |
| `application-uses-ports` | `application/**` may not import `infrastructure/**` (the `*.module.ts` file may) |
| `shared-and-infra-are-leaves` | `shared/**` and `infra/**` never import `modules/**` |
| `no-circular` | no cycles anywhere |

### 5.4 Bounded contexts (documented in `north-star.md`; only two are built now)

| Context | Responsibility | Built at foundation |
|---|---|---|
| health | liveness/readiness | yes |
| catalog | Brand, Product, ProductVariant (the only sellable unit), Category tree, Facets | **reference slice: Brand only** |
| inventory | stock on hand/reserved, reservations with expiry, movement ledger | no |
| cart | guest/customer carts, merge on login | no |
| checkout | the **only** module allowed to orchestrate across contexts; ends in the WhatsApp handoff (D4) | no |
| orders | immutable price/name snapshots, status history, state machine | no |
| shipping | methods, carrier port with a manual carrier first | no |
| customers | profiles, addresses (Iranian address model) | no |
| identity | users keyed by phone, OTP challenges, sessions, roles | no (designed, §5.8) |
| promotions, reviews, wishlist, notifications, audit, media | as named | no |
| payments | gateway port, attempts, idempotency — **planned seam, not wired** (D4) | no |

Invariants recorded in `north-star.md`: only variants are sellable; checkout orchestrates and every other module reacts to events; money is IRR minor units; cross-context data access goes through public services or events, never through another module's tables.

### 5.5 Cross-cutting concerns (all wired at foundation)

| Concern | Implementation |
|---|---|
| Config | `@nestjs/config` 12 with a Zod env schema (`validationSchema`); typed `AppConfig` provider; the process refuses to boot on invalid env |
| Validation | global `StandardSchemaValidationPipe`; controllers use `@Body({ schema })`, `@Query({ schema })`, `@Param(name, { schema })` with schemas from `packages/contracts`. No class-validator / class-transformer anywhere |
| Errors | `AppError` base with subclasses `NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`, `UnauthorizedError`; one global exception filter → RFC 9457 `application/problem+json`: `{ type, title, status, detail, instance, code, errors? }` where `code` is a stable machine string (e.g. `CATALOG_BRAND_NOT_FOUND`) and `instance` is the request id. Stack traces never leave the process in production. API text is developer-facing English; Persian copy exists only in the storefront |
| Security | `@fastify/helmet`; CORS allowlist from env with `credentials: true` and explicit methods; `@fastify/cookie`; `@nestjs/throttler` with Redis storage and a global default limit; `trustProxy: true`; `bodyLimit` 1 MiB; `rawBody: true` (future gateway callbacks) |
| Logging | nestjs-pino over Fastify's pino; `x-request-id` accepted or generated; `cookie`/`authorization` redacted; JSON in prod, pretty in dev |
| Health | `@nestjs/terminus`: `GET /health/live` (process up) and `GET /health/ready` (Postgres + Redis reachable) — used by Liara's health check and Docker `HEALTHCHECK` |
| OpenAPI | `@nestjs/swagger` 12 with `standardSchemaConverter` (zod-openapi). `pnpm --filter api openapi:generate` boots the app without listening and writes `apps/api/openapi.json` (committed). Swagger UI served only when `NODE_ENV !== 'production'` |
| Events | `EventPublisher` port; implementation = transactional outbox (§5.6) |
| Shutdown | `enableShutdownHooks()`; graceful close of HTTP, DB pool, Redis |

### 5.6 Domain events and the transactional outbox

Domain events are plain objects (`{ type, aggregateType, aggregateId, payload, occurredAt }`). Application services publish through the `EventPublisher` port **inside the same database transaction** as the state change. The Drizzle implementation inserts into `outbox_events` (`id bigint identity`, `aggregate_type`, `aggregate_id`, `event_type`, `payload jsonb`, `occurred_at`, `published_at`, `attempts`, `last_error`). The worker's `OutboxRelay` polls with `SELECT … WHERE published_at IS NULL ORDER BY id FOR UPDATE SKIP LOCKED LIMIT n`, dispatches each event to in-process handlers registered by module (`@OnDomainEvent('catalog.brand.created')`), marks `published_at`, and records failures with bounded retries. BullMQ is **not** introduced at foundation; ADR-0009 records that BullMQ 6 on Redis 7.2 is the queue for the first real asynchronous job (SMS, image variants), fed by the same relay.

### 5.7 Reference slice — `catalog` / Brand

- Domain: `Brand { id: uuidv7, slug (Latin, `^[a-z0-9-]+$`), name (Persian, normalized), description?, createdAt, updatedAt }`; invariant checks in the entity; `BrandCreated` domain event.
- Application: `BrandService.list(query)`, `BrandService.getBySlug(slug)`, `BrandService.create(input)` (used by the seed and by tests; **no HTTP route** — no unauthenticated writes exist anywhere).
- Infrastructure: `brands` table (§6.3), `DrizzleBrandRepository`.
- API: `GET /catalog/brands?page&pageSize` → paginated list; `GET /catalog/brands/:slug` → one or `404` problem `CATALOG_BRAND_NOT_FOUND`.
- Seed: ~6 brands with Persian display names and Latin slugs, inserted through `BrandService.create` (so the outbox receives events).

### 5.8 Authentication — designed, not built

Recorded in `north-star.md` for the future `identity` spec: phone-number OTP login (E.164, per-phone and per-IP throttling, hashed single-use codes with TTL), short-lived JWT access token in an `httpOnly; Secure; SameSite=Lax` cookie, opaque rotating refresh token stored hashed in Postgres, `Role` enum + `RolesGuard`, admin accounts require password + OTP. Cookies carry **no `Domain`** attribute so a later direct browser→API path is additive. Nothing from this section is scaffolded at foundation.

## 6. Data layer

### 6.1 Engine and driver

PostgreSQL 16 in every environment (local compose, CI Testcontainers, Liara). Drizzle ORM with the `pg` Pool (`max` from env, sane defaults). `casing: 'snake_case'`.

### 6.2 Schema ownership and migrations

- Each module owns its tables in `modules/<context>/infrastructure/schema.ts`. `src/infra/db/schema.ts` re-exports every module schema for drizzle-kit and the Drizzle client.
- Cross-module **database** foreign keys are allowed (integrity). Cross-module Drizzle `relations()` and query-level joins are **not** — call the other module's public service.
- Migrations: `drizzle-kit generate` produces SQL under `apps/api/drizzle/` (committed, reviewed in PRs). Migration `0000_extensions` (custom SQL) enables `pg_trgm` and creates `COLLATION fa (provider = icu, locale = 'fa')`.
- Applied by the container entrypoint (`node dist/migrate.js && node dist/main.js`): safe because Liara runs a single instance; migrations must be expand/contract compatible with the previous release.

### 6.3 Conventions (also encoded in `.claude/rules/db.md`)

| Convention | Rule |
|---|---|
| Names | snake_case tables and columns; singular module prefix not required; plural table names |
| Primary keys | `id uuid` = UUIDv7 generated in application code; ledgers/outbox use `bigint generated always as identity` |
| Timestamps | `created_at`, `updated_at` as `timestamptz`, UTC only; `updated_at` set by application code. Jalali is a display concern (§7.3) |
| Money | `amount_minor bigint` + `currency char(3)` (`IRR`); never Toman in storage, never floats; a shared `Money` value object does arithmetic and allocation |
| Persian text | normalized on write (Arabic ي/ك → Persian ی/ک; Persian/Arabic digits → ASCII); the `brands.name` column carries the pattern: a `search_text` generated column (normalized, ZWNJ → space) with a `pg_trgm` GIN index; `ORDER BY name COLLATE "fa"` |
| Human-facing ids | products (later) get a `public_id bigint` sequence for URLs; UUIDs stay internal |
| Soft delete | `deleted_at` only on rows that order history will reference; hard-delete everything else |
| Concurrency | `version integer` optimistic locking where contention exists (inventory, later); conditional single-statement updates for stock |
| Constraints | invariants as `CHECK`/`UNIQUE`/partial unique indexes, not only in code |

### 6.4 Transactions

Explicit: services open `db.transaction(async (tx) => …)` and pass the executor to repositories (`repo.create(brand, tx)`). No CLS/AsyncLocalStorage magic at foundation — visible transactions are what agents get right.

### 6.5 Redis and object storage

- Redis 7.2 via ioredis: throttler storage now; a `KeyValueStore` port (`get/set/del` with TTL) for OTP, idempotency and cache later. Readiness check pings it.
- `StorageProvider` port (`put`, `getSignedUrl`, `delete`, `head`) over `@aws-sdk/client-s3` with `forcePathStyle: true`, endpoint/region/bucket/keys from env. RustFS locally; Liara object storage (`https://storage.iran.liara.site`, region `default`) in production. A put/get/delete smoke test runs in the integration suite so Liara's S3 quirks are proven before media features exist. No upload endpoints.

### 6.6 Test data

Domain tests need no database. Repository and HTTP tests use Testcontainers (`postgres:16`, `redis:7.2`) started once per Vitest run in global setup, migrations applied, each test wrapped in a transaction that is rolled back (or truncated tables) for isolation. The seed is idempotent (`ON CONFLICT (slug) DO NOTHING`).

## 7. Storefront (`apps/web`)

### 7.1 Configuration

Next.js 16.3.3 or later (the release fixing two critical RCEs), React 19.2, Turbopack. `next.config.ts`: `reactCompiler: true`, `cacheComponents: true`, `output: 'standalone'`, `outputFileTracingRoot` at the repo root, `images.remotePatterns` for the media host, `images.formats: ['image/avif', 'image/webp']`, `images.qualities: [50, 75]`. No `proxy.ts` at foundation. `app/manifest.ts` present; **no service worker** (stale prices risk).

### 7.2 RTL and Persian rendering

- `app/layout.tsx` renders `<html lang="fa" dir="rtl">` unconditionally.
- Tailwind CSS 4.3 with **logical utilities only** (`ms- me- ps- pe- start- end- inset-s- text-start`). An ESLint `no-restricted-syntax` rule fails the build on physical direction classes (`ml- mr- pl- pr- left- right- text-left text-right`). The `rtl:` variant is reserved for mirroring directional icons.
- shadcn 4.19 initialized with `pnpm dlx shadcn@<pinned> init --rtl -b base` → `components.json` `rtl: true`, Base UI primitives, `DirectionProvider` in the root layout, `dir="rtl"` passed explicitly to portal components (tw-animate-css RTL bug).
- **Vazirmatn** variable woff2 (SIL OFL) vendored in `apps/web/app/fonts/` and loaded with `next/font/local` (`weight: '100 900'`, `display: 'swap'`, `variable: '--font-vazirmatn'`, Tahoma/Arial fallbacks) → Tailwind `--font-sans`. `font-feature-settings: "ss01"` where raw digits render Persian, `"tnum"` on price columns; `letter-spacing: 0` on Persian text; `next/font/google` is banned by lint.

### 7.3 `packages/persian` — the only place formatting happens

`formatToman(amountMinorIRR)` (÷10, grouping, Persian digits, "تومان"), `formatNumber`, `toPersianDigits`, `toAsciiDigits`, `normalizePersian` (ی/ک, digits, ZWNJ handling), `formatJalali(date, style)` via `Intl.DateTimeFormat('fa-IR', { calendar: 'persian', timeZone: TEHRAN_TZ })`, `TEHRAN_TZ = 'Asia/Tehran'` as the single constant, validators (`isIranMobile`, `isNationalId`, `isPostalCode`, `isSheba`) wrapping `@persian-tools`. Formatting happens **on the server** to avoid ICU hydration mismatches.

### 7.4 Data access boundary

**The Next.js server is the only caller of the API at foundation.**

- Reads: Server Components → `packages/api-client` `server` entry (`server-only`, `React.cache()` deduped) → `fetch(API_INTERNAL_URL)` over Liara's private network, forwarding the incoming `Cookie` and `x-request-id`.
- Writes (future): Server Actions through the same client, then `updateTag`/`revalidateTag`; auth re-checked inside every action.
- The browser never calls Nest directly: one origin, trivial CORS, simple cookies. Because API cookies carry no `Domain`, a direct browser→API path can be added later without breaking anything. TanStack Query is not installed until client-only/polled data exists.

### 7.5 Rendering strategy (documented in `.claude/rules/web.md`; the reference slice demonstrates the cached case)

| Page type | Strategy |
|---|---|
| Home, listings, brand pages | `'use cache'` + `cacheLife('hours')` + `cacheTag('catalog', …)`; filters read `searchParams` inside `<Suspense>` |
| Product detail (later) | core cached with `cacheTag('product:<id>')`; price/stock streamed in a Suspense island |
| Cart, checkout, account (later) | fully dynamic |

### 7.6 Errors

`error.tsx`, `not-found.tsx`, `global-error.tsx` with Persian copy. `api-client` turns `problem+json` into a typed `ApiError { status, code, detail, instance }`; `apps/web/lib/errors.ts` maps `code` → Persian message with a generic fallback. English never reaches the user.

### 7.7 URLs, SEO, images

- Brands: `/brands/{slug}` (Latin slugs). Products (later): `/product/{publicId}/{slug}` — the numeric `publicId` is canonical, the slug is free-form, mismatches 301 (Digikala's scheme).
- `metadataBase` from `NEXT_PUBLIC_SITE_URL`; root `generateMetadata` defaults (title template, `openGraph.locale: 'fa_IR'`); `app/robots.ts`; `app/sitemap.ts` (home + brands); a `jsonLd()` helper typed with `schema-dts` that escapes `<` and uses `priceCurrency: 'IRR'`.
- `next/image` only through a `<SiteImage>` wrapper (so a CDN `loaderFile` can be added later); no images exist in the reference slice.

### 7.8 Reference slice in web

`/` — RTL shell: header with the site name in Persian, font applied, one link to brands. `/brands` — cached server component calling `GET /catalog/brands`, rendering names (Persian) and slugs, sorted as the API returns them. That is the entire UI at foundation.

### 7.9 Tests and budgets

- Vitest + Testing Library + jsdom: `packages/persian` formatters/normalizers, `packages/contracts` schemas, synchronous components.
- Playwright: `locale: 'fa-IR'`, `timezoneId: 'Asia/Tehran'`, one desktop and one mobile project; `@axe-core/playwright` on `/` and `/brands`; asserts `dir="rtl"`, the font is applied, and brand names render. Runs in CI against the real API and database (§10).
- Budgets (documented targets, enforced later): ≤ 130 KB compressed first-load JS per route, font ≤ 120 KB, LCP ≤ 2.5 s / INP ≤ 200 ms on "Slow 4G" + 4× CPU throttle.

## 8. Contracts and API client

### 8.1 `packages/contracts`

Zod 4. Layout: `src/common/` (`id`, `pagination` request/response, `money`, `iranMobile`, `nationalId`, `postalCode`, `sheba`, `persianText` = `z.preprocess(normalizePersian, z.string().min(1).max(n))`, `slug`), `src/errors/` (`ProblemDetails` schema, `ErrorCode` enum), `src/catalog/brand.ts` (`Brand`, `BrandListQuery`, `BrandListResponse`). Types via `z.infer` and exported alongside. Built with `tsc -b` to ESM + `.d.ts`; both apps consume `dist`. Rule: contracts describe **HTTP shapes**, never domain entities; `apps/web` never imports the API's domain.

### 8.2 `packages/api-client`

`openapi-typescript` generates `src/generated/schema.d.ts` from `apps/api/openapi.json` (both committed; CI runs `pnpm openapi:generate` and fails on a diff). `createApiClient({ baseUrl, headers })` wraps `openapi-fetch` with middleware for cookie/request-id forwarding and `problem+json → ApiError`. Entry points: `.` (isomorphic) and `./server` (`server-only`, `React.cache`). Chosen over tRPC/ts-rest/oRPC because OpenAPI keeps the API consumable by the future admin app, a mobile app or partners; the Zod schemas remain the portable asset.

## 9. Local development, quality gates, dependency policy

### 9.1 Machine prerequisites

pnpm 11 (`npm i -g pnpm@<pinned>`), OrbStack (Docker), Node 24 (already present). Iranian registry mirrors are documented in `docs/runbooks/iran-mirrors.md` (Docker `registry-mirrors`, `TESTCONTAINERS_HUB_IMAGE_NAME_PREFIX`, npm mirror) as opt-in machine configuration, never committed defaults.

### 9.2 `infra/compose.yaml`

`name: dubaisupp`; services `postgres:16` (named volume), `redis:7.2-alpine`, `rustfs/rustfs` (S3 on 9000, console on 9001, bucket created by an init step), `axllent/mailpit` (SMTP 1025, UI 8025). Healthchecks on all four. Ports bound to `127.0.0.1`.

### 9.3 Environment variables

`.env.example` committed per app; `.env` git-ignored; both apps validate with Zod at boot; Turbo `envMode: strict` with every key declared in `turbo.json` `env`/`globalEnv`. Inventory in Appendix B.

### 9.4 Quality gates, in layers

1. **On save** (Claude Code PostToolUse hook): prettier + eslint on the edited file.
2. **On commit** (lefthook `pre-commit`): prettier `--write` + eslint on staged files, `stage_fixed`. **`commit-msg`**: commitlint (conventional commits; scopes = workspace names + `docs`, `infra`, `ci`) **and** `.claude/hooks/no-ai-trailers.sh` rejecting `co-authored-by`, `generated with`, `claude-session`, `noreply@anthropic.com` (case-insensitive).
3. **On push** (lefthook `pre-push`): `turbo run typecheck test --affected --output-logs=errors-only`.
4. **`pnpm check`**: lint + typecheck + test + boundaries + sherif — every task ends green.
5. **CI** (§10).

### 9.5 Dependency policy

Exact pins in the pnpm catalog. Renovate (`config:recommended`, weekly, `:semanticCommits`, `helpers:pinGitHubActionDigests`, `minimumReleaseAge: 3 days`): groups `@nestjs/*`, `next`/`react`/`eslint-config-next`, `eslint`/`typescript-eslint`, `drizzle-orm`/`drizzle-kit`; **blocks** `typescript >= 6.1` and `drizzle-orm >= 1.0` (each unblocked only by an ADR); automerges devDependency patch/minor. pnpm `allowBuilds` allowlist as in §4.2; `blockExoticSubdeps` on.

## 10. CI/CD

### 10.1 `ci.yml` (pull requests and pushes to `main`)

- `actions/checkout` (`fetch-depth: 0`), `pnpm/setup` with store cache (it installs by default — no second `pnpm install`), ubuntu runners.
- Job **check**: `pnpm turbo run lint typecheck test build --affected --output-logs=errors-only --env-mode=strict`; integration tests use Testcontainers (Docker is available on ubuntu runners).
- Job **openapi**: `pnpm openapi:generate && git diff --exit-code` (contracts, `openapi.json` and generated client are in sync).
- Job **e2e**: `postgres:16` + `redis:7.2` as services, migrate + seed, start api and web (production builds), run Playwright, upload the HTML report.
- Job **docker** (`main` only): build both images with BuildKit cache; `docker run` each with `PROCESS_ROLE=all` against the service containers and hit `/health/ready`.
- Job **authors**: `pnpm audit:authors` (§13.4).
- `permissions: contents: read`; `concurrency` cancel-in-progress per ref; action SHAs pinned by Renovate. Turbo remote cache off.

### 10.2 `deploy.yml` (manual `workflow_dispatch`, or after a green `ci.yml` on `main` via `workflow_run`)

`npm i -g @liara/cli@9`, then per app:

```
liara deploy --path . --liara-json infra/liara/api.json --platform docker --port 3000 \
  --app "$LIARA_APP_API" --api-token "$LIARA_API_TOKEN" --no-app-logs
```

(and `web.json` / `$LIARA_APP_WEB`). Liara builds the image from `build.dockerfile` with the repo root as context; `.liaraignore` excludes `node_modules`, `.next`, `dist`, `docs`, `.git`. `--build-location germany` is the documented fallback if base-image pulls fail on Liara's side. Environment variables are set once with `liara env set`, never through `liara.json` `envs` (it replaces all variables). `healthCheck` in each `liara.json` enables zero-downtime deploys.

### 10.3 Docker images (`infra/docker/`)

`Dockerfile.api`: `node:24-alpine` → install pnpm + turbo → `turbo prune api --docker` → install with a BuildKit store cache → build → `pnpm --filter api --prod deploy /prod/api` → runtime stage `node:24-alpine`, non-root user, `HEALTHCHECK` on `/health/live`, entrypoint `migrate → serve` selected by `PROCESS_ROLE`. `Dockerfile.web`: same prune/build, runtime copies `.next/standalone`, `.next/static`, `public`, non-root, `CMD node apps/web/server.js`. Both build from the repo root.

## 11. Hosting, topology, cost, domains

### 11.1 Providers

**Liara** PaaS (Docker platform for both apps), DBaaS and object storage; **ArvanCloud** DNS + CDN (free plan) in front of the storefront. Both are Iranian, satisfy Iran Access / half-price traffic, and Liara offers the Heroku-like workflow closest to Saman's Vercel habits. Exit path: `infra/compose.yaml` + the two Dockerfiles run unchanged on any Iranian VPS with Coolify/Dokploy.

### 11.2 Production topology (Toman/month, read 2026-08-27)

| Resource | Plan | Cost |
|---|---|---|
| `ds-web` (Next.js) | Liara Jupiter, 2 GB / 1 vCPU | 1,650,000 |
| `ds-api` (Nest, `PROCESS_ROLE=all`) | Liara Mars, 1 GB / 1 vCPU | 950,000 |
| PostgreSQL 16 | Liara DBaaS Mars | 950,000 |
| Redis 7.2 | Liara DBaaS Earth | 550,000 |
| Object storage 20 GB | Liara | 350,000 |
| DNS + CDN + edge TLS | ArvanCloud free plan | 0 |
| **Total** | | **≈ 4,450,000** |

All Liara resources live on **one private network created before anything else** (the choice is immutable). The API has **no public hostname**; the storefront reaches it at `http://ds-api:3000`. A separate `ds-worker` app (same image, `args` override to `worker`) is added when load justifies it. No staging environment at foundation.

### 11.3 Domains and DNS

- `.ir` (primary): registered **directly at nic.ir (IRNIC)** — cheapest, authoritative; requires a one-time HODA (هدا) face verification with national ID + a SIM in Saman's name.
- `.com`: bought in Rial through an Iranian reseller — **ParsPack** first choice, IranServer fallback; confirm EPP/transfer-out before purchase. Foreign registrars cannot take Iranian cards and may terminate Iran-resident accounts.
- Both domains' nameservers → ArvanCloud DNS. `.com` 301s to `.ir`. TLS at Arvan's edge plus Liara's free auto-TLS at origin.

### 11.4 `docs/runbooks/go-live.md` (outline)

Create Liara private network → DBs → object storage bucket → apps + env → first deploy (`first-deploy.md`) → domains → ArvanCloud DNS/CDN → ito.gov.ir half-price registration → enamad application when ready (and, per `regulatory.md`, the supplements licensing question).

## 12. Agentic development workflow and governance

### 12.1 Instruction files

- Root `CLAUDE.md` (< 150 lines): two-line project summary; commands; the **non-negotiables** — ESM with explicit `.js` relative specifiers; contracts are Zod only, no class-validator; logical Tailwind only; money = IRR minor units; Persian copy only in web; exact pins, never floating majors; never edit `src/generated/**` or `openapi.json` by hand; every task ends with `pnpm check`; spec → plan → TDD for every feature — plus commit/branch conventions and one import `@docs/architecture/north-star.md`.
- `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `packages/contracts/CLAUDE.md` — loaded on demand, each ≤ 60 lines, pointing at the reference slice as the template.
- `.claude/rules/*.md` with `paths:` frontmatter: `api.md` (`apps/api/**`), `web.md` (`apps/web/**`), `contracts.md`, `db.md` (`**/infrastructure/schema.ts`, `apps/api/drizzle/**`), `persian.md` (`packages/persian/**`, `apps/web/**`), `security.md`, `testing.md` (`**/*.test.ts`, `**/*.spec.ts`, `**/e2e/**`), `generated.md` (`**/src/generated/**`, `**/openapi.json`), `docs.md` (`docs/**`).
- `AGENTS.md`: a single line pointing at `CLAUDE.md`.

### 12.2 `.claude/settings.json` (committed)

- `"attribution": { "commit": "", "pr": "", "sessionUrl": false }`.
- `permissions.defaultMode: "acceptEdits"`; **allow** `Bash(pnpm *)`, `Bash(git status *)`, `Bash(git diff *)`, `Bash(git log *)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(gh pr view *)`, `Bash(gh pr create *)`, `WebFetch(domain:docs.nestjs.com)`, `WebFetch(domain:nextjs.org)`, `WebFetch(domain:orm.drizzle.team)`; **ask** `Bash(git push *)`, `Bash(pnpm add *)`; **deny** `Read(./.env)`, `Read(./.env.*)`, `Read(./**/dist/**)`, `Read(./**/.next/**)`, `Read(./**/coverage/**)`, `Edit(./pnpm-lock.yaml)`, `Bash(curl *)`, `Bash(wget *)`, `Bash(rm -rf *)`.
- Hooks: `PreToolUse` on `Bash` with `if: "Bash(git commit *)"` → `.claude/hooks/no-ai-trailers.sh` (exits 2 with a reason if the commit command contains an AI trailer); `PostToolUse` on `Edit|Write` → `.claude/hooks/format-and-lint.sh` (prettier, then eslint for `.ts/.tsx`; exits 0 for other files); `Stop` → `.claude/hooks/verify.sh` (`pnpm -w typecheck && pnpm -w test --changed`; exits 2 with the failure summary; honours `stop_hook_active`).
- `.claude/agents/reviewer.md`: read-only reviewer (Read/Grep/Glob/Bash) scoped to correctness, security, module boundaries, RTL/Persian, requirement gaps.
- `.claude/skills/`: `adr` (creates `docs/decisions/NNNN-title.md` from the MADR template), `new-api-module` (copies the catalog anatomy into a new context with placeholders replaced), `new-web-route`, `verify` (runs `pnpm check` and summarizes). Side-effect skills set `disable-model-invocation: true`.
- `.mcp.json`: Context7 only — `${CONTEXT7_API_KEY}` expanded from the environment; the key never enters the repo.

### 12.3 Spec-driven flow

Every feature is a vertical slice: brainstorm → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` → writing-plans → `docs/superpowers/plans/…` → TDD execution (subagent-driven) → code review (`/code-review` + the reviewer agent) → finish branch. `claude --worktree` per feature. `docs/architecture/north-star.md` plays the Spec-Kit "constitution" role; `docs/glossary.md` is the ubiquitous language (زبان مشترک) in Persian ↔ English, seeded with: مکمل supplement · برند brand · دسته‌بندی category · محصول product · تنوع/گونه variant · طعم flavor · موجودی stock · سبد خرید cart · تسویه‌حساب checkout · سفارش order · ارسال shipping · مشتری customer · کد تخفیف discount code · فاکتور invoice · درگاه پرداخت payment gateway · اینماد enamad.

### 12.4 ADRs written during the foundation (MADR minimal: Context and Problem Statement / Considered Options / Decision Outcome)

| # | Title |
|---|---|
| 0001 | NestJS 12 ESM on Fastify (spike outcome recorded here) |
| 0002 | Drizzle ORM over Prisma / MikroORM |
| 0003 | pnpm workspaces + Turborepo |
| 0004 | PostgreSQL 16 and Redis 7.2 (Liara ceilings; UUIDv7 in application code) |
| 0005 | Zod-first contracts → OpenAPI → openapi-fetch client |
| 0006 | Next.js Cache Components from day one; Next server is the only API caller |
| 0007 | Persian-only, RTL-only storefront; Vazirmatn; logical CSS only |
| 0008 | Money as IRR minor units with a configurable display unit |
| 0009 | Transactional outbox before any queue; BullMQ deferred |
| 0010 | Hosting on Liara + ArvanCloud; API not publicly exposed |
| 0011 | No online payment at launch; WhatsApp handoff seam in checkout |
| 0012 | Human-only git attribution and its enforcement |
| 0013 | Public repository with rulesets on `main` |

## 13. Git, GitHub, attribution

### 13.1 Repository

`github.com/samanhoseinpour/dubai-supplement`, **public** (D7). Local checkout `~/Desktop/dubai-supplement`. Created with `gh repo create --public` from the local repository after the author audit passes; first push contains only docs and the spec.

### 13.2 Identity

Repository-local `user.name "Saman Hoseinpour"`, `user.email samangithoseinpour@gmail.com` (must be a verified address on the GitHub account so commits link to the profile — Saman confirms in the plan's first task). Optional, recommended: SSH commit signing (`gpg.format ssh`, `commit.gpgsign true`, the same key uploaded as a *signing* key) for the "Verified" badge.

### 13.3 Branching and protection

Trunk-based: `main` plus short-lived `feat/*`, `fix/*`, `chore/*`, `docs/*`; squash merges; conventional commit titles. GitHub **ruleset on `main`**: require a pull request, require the `check`, `openapi`, `e2e` and `authors` status checks, block force-pushes and deletions; repository admin may bypass for emergencies. PR template checklist: spec/plan linked · tests added · `pnpm check` green · no AI trailers · docs/ADR updated if a term or decision was introduced.

### 13.4 Attribution enforcement, three layers

1. Claude Code `attribution` settings (project and user level) — the text is never generated.
2. `PreToolUse` hook and lefthook `commit-msg` hook — blocked if it appears anyway.
3. `pnpm audit:authors` (`scripts/audit-authors.sh`): `git log --all --format='%an <%ae>'` must contain only `Saman Hoseinpour <samangithoseinpour@gmail.com>`; `git log --all --format='%B'` must contain no `co-authored-by` / `generated with` / `noreply@anthropic.com`; runs in CI (`authors` job) and before every push. The Claude GitHub App/Action is never installed for commits.

## 14. Reference slice — end-to-end data flow

1. `packages/contracts/src/catalog/brand.ts` defines `BrandSchema`, `BrandListQuerySchema`, `BrandListResponseSchema`.
2. `apps/api` `catalog` module: `GET /catalog/brands` validates the query with `@Query({ schema: BrandListQuerySchema })`, calls `BrandService.list`, which calls `BrandRepository.list(tx?)` (Drizzle, `ORDER BY name COLLATE "fa"`), and returns a `BrandListResponse`. `GET /catalog/brands/:slug` throws `NotFoundError('CATALOG_BRAND_NOT_FOUND')` → `404 problem+json`.
3. `pnpm openapi:generate` → `apps/api/openapi.json` → `packages/api-client/src/generated/schema.d.ts`.
4. `apps/web/app/brands/page.tsx` (`'use cache'`, `cacheLife('hours')`, `cacheTag('catalog')`) calls `api.GET('/catalog/brands')` through the server client and renders the names RTL in Vazirmatn.
5. Seed: `pnpm db:seed` inserts brands through `BrandService.create` inside a transaction that also writes `outbox_events`; the worker relay dispatches `catalog.brand.created` to a logging handler.
6. Tests: contracts (parse/normalize), domain (invariants), integration (repository + `app.inject()` + outbox relay + S3 smoke), web unit (persian formatters), Playwright (`/`, `/brands`, axe).

## 15. Testing strategy summary

| Level | Tool | Lives in | Needs |
|---|---|---|---|
| Unit (domain, contracts, persian, components) | Vitest | colocated `*.test.ts(x)` | nothing |
| Integration (repositories, HTTP via `app.inject()`, outbox, storage) | Vitest + Testcontainers | `apps/api/test/integration/` | Docker |
| End-to-end | Playwright + axe | `apps/web/e2e/` | api + db (compose locally, services in CI) |
| Static | ESLint, typescript, dependency-cruiser, sherif, commitlint | `pnpm check` | nothing |

TDD is the default for every task in the plan (failing test → minimal code → refactor); the reference slice is built that way so agents see the pattern.

## 16. Definition of done (foundation)

1. `pnpm install`, `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` bring up api and web; `/brands` renders the seeded Persian names right-to-left in Vazirmatn.
2. `pnpm check` is green locally; `ci.yml` is green on GitHub (check, openapi, e2e, docker, authors).
3. `openapi.json` and the generated client are current (CI-enforced).
4. Outbox relay and S3 smoke tests pass.
5. Both Docker images build in CI and run locally with `PROCESS_ROLE=all`, answering `/health/ready`.
6. Docs exist and are accurate: `north-star.md`, `glossary.md`, `regulatory.md`, `runbooks/{iran-mirrors,go-live,first-deploy}.md`, ADRs 0001–0013, research, `CLAUDE.md` + package `CLAUDE.md`s + rules + hooks + reviewer agent + skills + `.mcp.json`.
7. `pnpm audit:authors` passes: every commit by Saman Hoseinpour, zero AI trailers; repository pushed to `github.com/samanhoseinpour/dubai-supplement` with the `main` ruleset enabled.
8. ADR-0001 records the Nest 12 spike outcome.

## 17. Out of scope (each gets its own spec)

Products/variants/categories beyond Brand, inventory, cart, checkout and the WhatsApp handoff, OTP/identity, admin app, media pipeline (uploads, sharp variants, CDN loader), search (Meilisearch), promotions, SMS/notifications, payments (Zibal/PayStar adapters), enamad application, analytics/observability (Umami, GlitchTip), staging environment, BullMQ, TanStack Query, `packages/ui`.

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| NestJS 12 is days old; third-party peer lag; agents emit CJS/class-validator patterns | Spike with a fallback (§5.1); `.claude/rules/api.md`; typecheck under `nodenext` fails on bad specifiers; dependency-cruiser |
| TypeScript 7 / Drizzle 1.0 / Next majors landing mid-project | Exact pins; Renovate blocks; ADR required to unblock |
| Iranian network: domestic servers losing access to npm/Docker Hub/GitHub | Images built in CI; nothing fetched at runtime; `--build-location germany` fallback; mirrors runbook |
| Liara has no Postgres 17/18 or Valkey | PG 16 + Redis 7.2 everywhere; UUIDv7 in code |
| Public repository leaks a secret | `.env*` ignored and deny-listed for agents; `.mcp.json` uses env expansion; CI secret scanning (GitHub push protection is on for public repos) |
| Supplements sold online without an FDO/pharmacy licence (Iran FDA, 13 Jun 2026) | Business risk owned by Saman; recorded in `docs/regulatory.md`; the WhatsApp handoff keeps the site catalogue-first |
| ICU differences between Node versions cause hydration mismatches | Format on the server only; pinned Node 24 in every environment |
| Solo dev + public repo without paid plan | Rulesets available on public repos; hooks + CI as the real guard |

## 19. Manual actions only Saman can take (tracked in the plan)

1. Confirm `samangithoseinpour@gmail.com` is verified on GitHub (or choose the noreply address).
2. Install pnpm 11 and OrbStack; optionally configure Iranian registry mirrors.
3. Create the GitHub repository (the plan runs `gh repo create --public` with Saman present) and enable the `main` ruleset.
4. Liara account, private network, DBs, storage, apps, API token → `LIARA_API_TOKEN` secret.
5. ArvanCloud account (DNS/CDN).
6. HODA verification + `.ir` at nic.ir; `.com` at ParsPack; nameservers → ArvanCloud.
7. Context7 API key in the local environment (optional).

## Appendix A — Version pin table

Filled in by the first implementation task from the npm registry on the day of installation and kept in `pnpm-workspace.yaml` `catalog:`. Targets: see §4.2.

## Appendix B — Environment variable inventory

| App | Variable | Purpose |
|---|---|---|
| api | `NODE_ENV`, `PROCESS_ROLE` (`api`/`worker`/`all`), `PORT` (3000), `LOG_LEVEL` | runtime |
| api | `DATABASE_URL`, `DATABASE_POOL_MAX` | Postgres |
| api | `REDIS_URL` | Redis |
| api | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` (true) | object storage |
| api | `CORS_ORIGINS` (comma-separated), `TRUST_PROXY` (true) | HTTP |
| api | `OPENAPI_UI_ENABLED` (dev only) | docs |
| web | `NODE_ENV`, `PORT` (3000), `API_INTERNAL_URL` (`http://ds-api:3000` in prod, `http://localhost:3001` locally), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MEDIA_URL` | runtime |
| CI | `LIARA_API_TOKEN`, `LIARA_APP_API`, `LIARA_APP_WEB` | deploy |
| local only | `CONTEXT7_API_KEY` | MCP |

Locally the API listens on **3001** and web on **3000** so both run side by side; in production each container listens on 3000.
