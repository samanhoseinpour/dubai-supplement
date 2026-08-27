# Dubai Supplement — Foundation Design

| | |
|---|---|
| **Date** | 2026-08-27 (revised the same day after a 14-agent adversarial review; 81 findings triaged) |
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
- **Iran network reality:** Shaparak gateways accept only Iranian IPs ("Iran Access"); half-price domestic traffic (ترافیک نیم‌بها) requires an Iranian data centre and ito.gov.ir registration; after the 2026 shutdown the network is allowlist-shaped. Therefore: everything the customer touches is hosted inside Iran, and **nothing is fetched from foreign hosts at request time** (fonts, scripts, images are self-hosted). Production images are built by Liara from our Dockerfiles at deploy time (§10.2); the same Dockerfiles are built in CI on every push to `main` so a build that fails on Liara's side is a Liara reachability problem (mitigated by `--build-location germany`), never a code problem discovered at deploy.
- **Ecosystem timing (as of 2026-08-27):** NestJS 12.0.1 (pure ESM) shipped today; TypeScript 7.0 has no compiler API and breaks `nest build` → **TypeScript stays on 6.0.x**; Drizzle 1.0 is at release-candidate stage (`1.0.0-rc.x`, breaking API changes) → **Drizzle 0.45.x** (`latest` = 0.45.2); Node 24 is the current LTS. **Every dependency is exact-pinned**; Renovate proposes upgrades.
- **Liara limits (verified 2026-08-27):** managed PostgreSQL tops out at **16.3**, Redis at **7.2** (no Valkey); no horizontal scaling; Docker platform required for a pnpm monorepo; private container registries unsupported (Liara builds from the Dockerfile); `--port` must be passed explicitly in CI; every app gets a public `<app>.liara.run` subdomain that must be disabled by hand. **Unverified until first deploy:** whether Liara's PostgreSQL is an ICU build (needed for the `fa` collation, §6.2).
- **Solo developer + AI agents:** every pattern must be copyable, every rule must be enforced by a tool rather than by prose, and there must be one verification command (`pnpm check`).
- **Human-only authorship:** every commit is authored by Saman Hoseinpour — or by the Renovate GitHub App for dependency bumps only; no AI co-author trailers or "generated with" footers, ever.

## 4. Repository skeleton and toolchain

### 4.1 Layout

```
dubai-supplement/
├── apps/
│   ├── api/                 NestJS 12 ESM + Fastify. src/main.ts (one bootstrap; role from PROCESS_ROLE) · src/worker.ts (worker bootstrap)
│   │                        · src/migrate.ts · src/seed.ts · src/openapi.ts · drizzle.config.ts · drizzle/ (SQL migrations)
│   │                        · .dependency-cruiser.cjs · vitest.config.ts · vitest.integration.config.ts · .env.example · openapi.json
│   ├── web/                 Next.js 16.3 storefront (fa, RTL) — output: standalone · app/health/route.ts · e2e/ · .env.example
│   └── admin/               reserved: README.md only, not scaffolded (separate Next.js app later, shares packages/)
├── packages/
│   ├── contracts/           @ds/contracts — Zod 4 schemas + inferred types, the single source of truth for HTTP shapes (compiled ESM + d.ts)
│   ├── api-client/          @ds/api-client — openapi-typescript types (committed under src/generated/) + openapi-fetch wrapper (compiled)
│   ├── persian/             @ds/persian — normalizers, validators (persian-tools), fa-IR Intl formatters (compiled ESM + d.ts)
│   ├── config-eslint/       @ds/config-eslint — shared ESLint 10 flat configs (base / nest / next)
│   └── config-typescript/   @ds/config-typescript — base.json · nestjs.json · nextjs.json · library.json
├── infra/
│   ├── compose.yaml         postgres:16 · redis:7.2 · rustfs (S3) · mailpit — local only
│   ├── docker/              Dockerfile.api · Dockerfile.web · entrypoint.sh (multi-stage, turbo prune, repo-root context)
│   └── liara/               api.json · web.json (Liara app manifests)
├── scripts/                 audit-authors.sh · audit-authors.allowed · check-commit-msg.sh · check-docs.sh
├── docs/
│   ├── architecture/north-star.md   bounded contexts, dependency directions, invariants, non-goals — the only always-loaded doc
│   ├── decisions/                   0000-template.md + ADRs (MADR minimal), NNNN-title.md
│   ├── glossary.md                  Persian ↔ English domain vocabulary (the ubiquitous language)
│   ├── regulatory.md                enamad, Iran FDA supplements rule, TTAC, rial redenomination — facts and dates
│   ├── runbooks/                    iran-mirrors.md · go-live.md · first-deploy.md
│   ├── research/                    the 2026-08-27 research report and Liara verification (see §19.2 for the public/private decision)
│   └── superpowers/{specs,plans}/   this spec and the plans that follow
├── .claude/                 settings.json · rules/ · hooks/ · agents/ · skills/
├── .github/                 workflows/ci.yml · workflows/deploy.yml · PULL_REQUEST_TEMPLATE.md · renovate.json
├── CLAUDE.md · AGENTS.md (one line → CLAUDE.md) · README.md · .mcp.json
└── package.json · pnpm-workspace.yaml · turbo.json · lefthook.yml · commitlint.config.mjs · prettier.config.mjs
    · .node-version · .editorconfig · .gitattributes · .gitignore · .dockerignore · .liaraignore · .gitleaks.toml
```

**Workspace names and import paths.** Apps: `api`, `web`, `admin`. Packages: `@ds/contracts`, `@ds/api-client`, `@ds/persian`, `@ds/config-eslint`, `@ds/config-typescript` — all `"private": true`, referenced with `workspace:*`. Import paths: `@ds/contracts`, `@ds/persian`, `@ds/api-client`, `@ds/api-client/server`. Turbo task ids: `api#openapi`, `@ds/api-client#generate`. Commitlint scopes: `api web contracts api-client persian config docs infra ci deps`.

**Compiled packages.** `@ds/contracts`, `@ds/persian` and `@ds/api-client` are built with `tsc -b` (`library.json`: composite, declaration, declarationMap) to `dist/` (ESM + `.d.ts`) with `exports` maps, because the API under `nodenext` consumes compiled JavaScript; `apps/web` consumes the same `dist`.

### 4.2 Toolchain and versions

Target versions were verified against the npm registry on 2026-08-27 (Appendix A lists the exact patches). The exact patch installed is pinned in the pnpm `catalog:` at implementation time and thereafter changed only by Renovate PRs.

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 24.x | Pinned via `devEngines.runtime` (`onFail: download`) and `.node-version`; no nvm/corepack |
| Language | TypeScript 6.0.x | TS 7 blocked by Renovate; tsconfigs written TS-7-clean (no `baseUrl`, no `paths`) |
| Package manager | pnpm 11.24.x | **All pnpm settings live in `pnpm-workspace.yaml`** (pnpm 11 ignores the `pnpm` field of package.json): `catalog:` + `catalogMode: strict`; `allowBuilds` allowlist (`esbuild`, `@swc/core`, `sharp`, `lefthook`); `minimumReleaseAge` default 1440 min with `minimumReleaseAgeExclude: ['@nestjs/*']` while 12.0.x is < 24 h old; `forceLegacyDeploy: true` (so `pnpm deploy` works with symlinked workspaces; `injectWorkspacePackages` stays off so `pnpm dev` sees rebuilt `dist` through symlinks); `peerDependencyRules.allowedVersions` for the Nest-12 peer lag (§5.1); `blockExoticSubdeps: true` |
| Task runner | Turborepo 2.10.x | `build` dependsOn `["^build"]` exactly; `dev` dependsOn `^build`, persistent, no cache; `envMode: strict`; remote cache **off** |
| Backend | NestJS 12.0.x, `@nestjs/platform-fastify` 12.0.x, Fastify 5.12.x, `@nestjs/cli` 12.0.x | ESM (`"type": "module"`, `nodenext`); SWC builder with `typeCheck: true`; fallback NestJS 11.2.x CJS if the spike fails (§5.1) |
| Validation | Zod 4.4.x, zod-openapi 6.0.x | Nest 12 native `StandardSchemaValidationPipe`; `@nestjs/swagger` 12 `standardSchemaConverter`; `class-validator`/`class-transformer` are never imported (ESLint `no-restricted-imports`) though they may appear in the lockfile as auto-installed peers of `@nestjs/swagger` |
| ORM | Drizzle ORM 0.45.x, drizzle-kit 0.31.x, `pg` 8.23.x, `tsx` for scripts | `casing: 'snake_case'` (camelCase keys in schema files, names derived); SQL migrations committed |
| Database | PostgreSQL 16 | Liara ceiling; `pg_trgm`; ICU collation `fa` (verified on Liara before first migration) |
| Cache / rate limit | Redis 7.2, ioredis 5.11.x, `@nest-lab/throttler-storage-redis` 1.2.x | Throttler storage now; `KeyValueStore` port for later |
| Object storage | `@aws-sdk/client-s3` 3.x | `forcePathStyle: true`; RustFS locally, Liara in prod |
| Ids | `uuid` (`v7()`) | UUIDv7 in application code — PostgreSQL 16 has no native `uuidv7()` |
| Frontend | Next.js 16.3.3+, React 19.2.x, Turbopack, `babel-plugin-react-compiler` 1.0.x (devDependency, required by `reactCompiler: true`), `server-only` | `cacheComponents: true`, `output: 'standalone'` |
| UI | Tailwind CSS 4.3.x, shadcn 4.19.x (`init --rtl -b base`), `@base-ui/react` 1.7.x, lucide-react | Logical utilities only |
| Font | Vazirmatn variable (SIL OFL), vendored | `next/font/local` |
| Persian utils | `@persian-tools/persian-tools` 4.0.x (dependency of `@ds/persian` only) | Intl for formatting; date-fns-jalali only when arithmetic is needed (not at foundation) |
| Testing | Vitest 4.1.x, `@vitest/coverage-v8`, jsdom, `@testing-library/react` + jest-dom, Testcontainers 12.1.x, `@playwright/test` 1.62.x, `@next/playwright`, `@axe-core/playwright` 4.13.x | One runner repo-wide |
| Lint/format | ESLint 10.9.x flat, typescript-eslint 8.68.x `strictTypeChecked`, eslint-config-next, eslint-plugin-boundaries 7.2.x, dependency-cruiser 18.2.x, Prettier 3.9.x + prettier-plugin-tailwindcss, sherif 1.13.x | |
| Git hooks / secrets | lefthook 2.1.x, `@commitlint/cli` + `config-conventional` 21.2.x, gitleaks (CI action, SHA-pinned) | |
| Contracts → client | openapi-typescript 7.13.x, openapi-fetch 0.17.x | |
| Logging | nestjs-pino 4.6.x, pino 10.x, pino-pretty (dev only) | |

### 4.3 Dependency rules (enforced)

1. `apps/*` may depend on `packages/*`. Packages never depend on apps. Allowed package→package edges: `@ds/api-client → @ds/contracts` (types only) and `@ds/contracts → @ds/persian` (runtime: `normalizePersian` and the validators behind `persianText`, `iranMobile`, `nationalId`, `postalCode`, `sheba`). `@ds/persian` has no workspace dependencies and owns the only `@persian-tools/persian-tools` dependency.
2. `@ds/contracts` has exactly two runtime dependencies: `zod` and `@ds/persian` (`@persian-tools` is therefore transitive).
3. `@ds/api-client` compiles the **committed** `src/generated/schema.d.ts`; `@ds/api-client#build` does **not** depend on generation. `pnpm openapi:generate` = `turbo run generate --filter=@ds/api-client`, where `@ds/api-client#generate` dependsOn `api#openapi`, which dependsOn `api#build` (which dependsOn `@ds/contracts#build`). Freshness is enforced by the CI `openapi` job and `.claude/rules/generated.md`. No `build`, `check` or Docker stage lists `openapi`/`generate`, so Docker builds of `web` never boot the API.
4. `apps/web` never imports from `apps/api` (not even types); it uses `@ds/contracts` and `@ds/api-client` only.
5. Enforcement: pnpm isolated `node_modules` (undeclared imports fail), `dependency-cruiser` in `apps/api` (module boundaries, §5.3; task `boundaries`), `eslint-plugin-boundaries` in both apps, `sherif` for cross-workspace version drift — all wired into `pnpm check`.

### 4.4 Root scripts

| Script | Does |
|---|---|
| `pnpm dev` | `turbo run dev`: builds `@ds/contracts`, `@ds/persian`, `@ds/api-client` once via `^build`, then contracts/persian watch, api `nest start --watch`, web `next dev` |
| `pnpm db:up` / `pnpm db:down` | `docker compose -f infra/compose.yaml up -d --wait` / `down` |
| `pnpm db:generate` | `pnpm --filter api exec drizzle-kit generate` (add `--custom --name=<name>` for hand-written SQL) |
| `pnpm db:migrate` / `pnpm db:seed` | `pnpm --filter api exec tsx src/migrate.ts` / `… tsx src/seed.ts` |
| `pnpm openapi:generate` | see §4.3(3) — api boots, writes `openapi.json`, api-client regenerates `schema.d.ts` |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm test:integration` / `pnpm boundaries` | `turbo run <task> --output-logs=errors-only` (`test` = unit, no Docker; `test:integration` = Testcontainers) |
| `pnpm check` | `turbo run lint typecheck test test:integration boundaries --output-logs=errors-only && sherif` — **the** verification command |
| `pnpm check:affected` | same, `--affected` (sherif always runs repo-wide) |
| `pnpm build` | `turbo run build` |
| `pnpm format` | prettier write |
| `pnpm audit:authors` | `scripts/audit-authors.sh` (§13.4) |
| `pnpm check:docs` | `scripts/check-docs.sh` (§16.6) — also part of `pnpm check` |

### 4.5 Deliberately not created (YAGNI)

`packages/ui` (shadcn lives in `apps/web` until an admin app exists), `packages/env` (each app validates its own env), Storybook, changesets, Nx, TanStack Query, next-intl, BullMQ (§5.6), a staging environment, image configuration and `NEXT_PUBLIC_MEDIA_URL` (media spec), `<SiteImage>` / `jsonLd()` / `app/manifest.ts` (media and SEO specs), a `money` contract schema (products spec).

## 5. Backend architecture (`apps/api`)

### 5.1 Framework and the Nest 12 spike

NestJS 12 ESM on Fastify. Because 12.0.x is days old and several third-party packages still declare `<=11` peers, the **first `apps/api` task is a time-boxed spike (≤ 60 minutes wall-clock, one plan task):**

1. `pnpm dlx @nestjs/cli@<pinned> new api --strict --skip-git --skip-install --package-manager pnpm --directory apps/api`, choosing **ESM** at the prompt (record the answer in ADR-0001).
2. Reconcile the scaffold with §4.2: delete its lint config, `tsconfig.build.json`, `test/`, prettier file and supertest dependency; `tsconfig.json` = `{ "extends": "@ds/config-typescript/nestjs.json", … }`; `nest-cli.json` `compilerOptions: { builder: 'swc', typeCheck: true }`; every dependency rewritten to `catalog:`; keep `vitest.config.ts`.
3. Peer overrides in `pnpm-workspace.yaml` (they only silence warnings — install does not fail on unmet peers, so the boot test is the real gate): `peerDependencyRules.allowedVersions` for `@nestjs/terminus`, `@nestjs/throttler`, `@nest-lab/throttler-storage-redis`, `nestjs-pino` against `@nestjs/common`/`@nestjs/core` `12`.
4. Add the Fastify adapter, `TerminusModule`, `ThrottlerModule` with `@nest-lab/throttler-storage-redis` (ioredis `lazyConnect: true`), `LoggerModule.forRoot()` (nestjs-pino).
5. **Go:** `pnpm install` resolves, `nest build` passes, and `apps/api/test/integration/health.test.ts` (`FastifyAdapter`, `app.init()`, `getHttpAdapter().getInstance().ready()`, `app.inject({ method: 'GET', url: '/health/live' })`) returns 200. **No-go:** any of those fails at the 60-minute mark → fall back to NestJS 11.2.x CJS + nestjs-zod with the *same* module anatomy and contracts; nothing else in this spec changes. Either outcome is ADR-0001.

### 5.2 Process topology

One codebase, one Docker image, **one bootstrap** `src/main.ts` that reads `PROCESS_ROLE` (default `api`):

- `api` → `NestFactory.create` (Fastify) + `listen`.
- `all` → the same HTTP app, and `OutboxRelay.start()` inside it (one DI container, one pool — no second application context). This is the launch configuration on Liara and the local default (`PROCESS_ROLE=all` in `apps/api/.env.example`).
- `worker` → `bootstrapWorker()` from `src/worker.ts`: `NestFactory.createApplicationContext` (no HTTP), relay only (queue consumers and cron later).

Container entrypoint `infra/docker/entrypoint.sh`:

```sh
set -e
if [ "${PROCESS_ROLE:-api}" != "worker" ]; then node dist/migrate.js; fi
exec node dist/main.js
```

The worker never migrates and is deployed only after `ds-api` has migrated. Both bootstraps call `enableShutdownHooks()`; `OutboxRelay.stop()` awaits the in-flight cycle on SIGTERM before the process exits. Liara's `args` override is **not** used; a future `ds-worker` app sets `PROCESS_ROLE=worker` via `liara env set`.

### 5.3 Module anatomy and boundaries

Every bounded context has the same shape:

```
src/modules/<context>/
├── index.ts                 the ONLY import path other modules may use (public services, events, types; optionally a `tables` namespace — §6.2)
├── <context>.module.ts      Nest wiring: ports → adapters
├── api/                     controllers; request/response shapes come from @ds/contracts
├── application/             use-case services, ports (interfaces), transaction boundaries
├── domain/                  entities, value objects, domain events, domain errors — pure TypeScript
└── infrastructure/          Drizzle schema (schema.ts) + repositories implementing the ports, external adapters
src/shared/                  Money value object (minimal), AppError hierarchy, pagination helpers, ids, openapi helpers — imports nothing from modules/
src/infra/                   config, db, redis, storage, logger, health, outbox (incl. outbox/schema.ts) — imports nothing from modules/
```

`dependency-cruiser` rules (`apps/api/.dependency-cruiser.cjs`, task `boundaries`, part of `pnpm check`):

| Rule | Meaning |
|---|---|
| `no-cross-module-internals` | `modules/A/**` may import `modules/B/index.ts` only |
| `domain-is-pure` | `domain/**` may not import `@nestjs/*`, `drizzle-orm`, `pg`, `ioredis`, or sibling layers |
| `application-uses-ports` | `application/**` may not import `infrastructure/**` (the `*.module.ts` file may) |
| `shared-and-infra-are-leaves` | `shared/**` and `infra/**` never import `modules/**` (no exceptions; §6.2 is designed so none is needed) |
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
| Config | `@nestjs/config` 12 with a Zod env schema (`validationSchema`); typed `AppConfig` provider; the process refuses to boot on invalid env. `apps/api/.env.example` holds **schema-valid localhost values** for every key in Appendix B (it is copied to `.env` in CI jobs that need no live services) |
| Validation | global `new StandardSchemaValidationPipe({ exceptionFactory: (issues) => new ValidationError(issues) })`; controllers use `@Body({ schema })`, `@Query({ schema })`, `@Param(name, { schema })` with schemas from `@ds/contracts`. No `ValidationPipe`, class-validator, DTO classes or `@ApiProperty` anywhere |
| Errors | `AppError(code: ErrorCode, detail?: string, meta?: Record<string, unknown>)` with subclasses and statuses: `ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `RateLimitedError` 429; anything else → 500 `INTERNAL`. One global exception filter → RFC 9457 `application/problem+json`: `{ type: "urn:problem:<code>", title: <English constant per code>, status, detail, instance: <request id>, code, errors?: [{ path, message }] }` where `errors` serializes Standard Schema `issues` (`path.map(String).join('.')`). Stack traces never leave the process in production. API text is developer-facing English; **Persian copy exists only in the storefront** |
| Security | `@fastify/helmet`; CORS registered **only when `CORS_ORIGINS` is non-empty** (foundation default: empty — no CORS headers; the storefront is server-to-server): `origin: <array>`, `credentials: true`, explicit methods; Zod rejects `*`/`null` entries; `@fastify/cookie`; `@nestjs/throttler` with `@nest-lab/throttler-storage-redis` (fallback: a `ThrottlerStorage` over ioredis in `src/infra/redis` if the package fails under ESM), tracker `req.ip`, global default limit; `trustProxy` from `TRUST_PROXY` = hop count or CIDR list (Zod `z.union([z.coerce.number().int().min(0), z.string().min(1)])`; the boolean `true` is rejected) — `1` locally and in production (`ds-web` is the only direct client; confirmed in `first-deploy.md`); `bodyLimit` 1 MiB; `rawBody: true` (future gateway callbacks). Integration tests assert: an unlisted `Origin` gets no `Access-Control-Allow-Origin`; `X-Forwarded-For` from an untrusted hop is ignored; two forwarded IPs get separate throttle buckets |
| Logging | nestjs-pino over Fastify's pino (`logger: false` on the adapter); `x-request-id` accepted or generated; `cookie`/`authorization` redacted; JSON in prod, `pino-pretty` in dev |
| Health | `@nestjs/terminus` (`HealthIndicatorService`, not the deprecated base class): `GET /health/live` (process up) and `GET /health/ready` (Postgres + Redis reachable, plus a non-failing detail `outbox.dead` = parked event count). **Liara `healthCheck` → `/health/ready`** (traffic never switches to a container that cannot reach its stores); **Docker `HEALTHCHECK` in `Dockerfile.api` → `/health/live`** (liveness only, so a Redis blip never restart-loops the container) |
| OpenAPI | `@nestjs/swagger` 12 with `standardSchemaConverter` (zod-openapi `createSchema`). Response schemas via a shared decorator `@ApiZodResponse(status, schema)` in `src/shared/openapi/` that converts with `createSchema(schema, { io: 'output' })` and applies `ApiResponse({ status, schema })`; foundation schemas carry no `.meta({ id })`, so `components` is empty and the decorator asserts that. `src/openapi.ts` (`pnpm --filter api openapi`) boots the app **without listening**, writes `apps/api/openapi.json` (committed) and exits — it needs a schema-valid env but **no live services**: `pg.Pool` connects on first query, ioredis is created with `lazyConnect: true` (and that instance is handed to the throttler storage), the S3 client is lazy, and nothing pings a store at boot. Swagger UI served only when `OPENAPI_UI_ENABLED=true` (dev) |
| Events | `EventPublisher` port; implementation = transactional outbox (§5.6). `@nestjs/event-emitter` is **not** used (banned by rule) |
| Shutdown | `enableShutdownHooks()`; graceful close of HTTP, relay, DB pool, Redis |

### 5.6 Domain events and the transactional outbox

Domain events are plain objects `{ type, aggregateType, aggregateId, payload, occurredAt }`; `type` follows `<context>.<aggregate>.<past-tense-verb>` (`catalog.brand.created`); `payload` carries the aggregate's identity plus the changed fields (`{ id, slug, name }`). Application services publish through the `EventPublisher` port **inside the same database transaction** as the state change. The Drizzle implementation inserts into `outbox_events` (`src/infra/outbox/schema.ts`: `id bigint generated always as identity`, `aggregate_type`, `aggregate_id`, `event_type`, `payload jsonb`, `occurred_at`, `published_at`, `attempts int default 0`, `last_error text`).

`OutboxRelay` (`src/infra/outbox/`):
- Handlers are methods decorated with `@OnDomainEvent('catalog.brand.created')` on any provider; discovered at startup with `DiscoveryService` from `@nestjs/core`; handlers must be idempotent.
- `runOnce()` (the unit tests call it directly; `start()` loops it every `OUTBOX_POLL_MS`, default 1000): one transaction — `SELECT … FROM outbox_events WHERE published_at IS NULL AND attempts < 5 ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 50`; for each row run its handlers sequentially; on success set `published_at`; on the first throwing handler stop that event, increment `attempts`, store `last_error` (the event is retried on a later poll); commit. `runOnce()` returns `{ processed, failed }`.
- Rows reaching `attempts = 5` are **parked** (still `published_at IS NULL`, `last_error` set), excluded by the query, counted on `/health/ready` as `outbox.dead`, and require manual intervention. No dead-letter table at foundation.
- BullMQ is **not** introduced; ADR-0009 records that BullMQ 6 on Redis 7.2 is the queue for the first real asynchronous job (SMS, image variants), fed by the same relay.

### 5.7 Reference slice — `catalog` / Brand

- **Domain:** `Brand { id: uuidv7, slug (Latin, `^[a-z0-9-]+$`, ≤ 64), name (Persian, ≤ 200, normalized in the entity constructor with `normalizePersian` from `@ds/persian`), description? (≤ 2000, normalized), createdAt, updatedAt }`; `BrandCreated` domain event.
- **Application:** `BrandService.list(query)`, `BrandService.getBySlug(slug)` (throws `NotFoundError('CATALOG_BRAND_NOT_FOUND')`), `BrandService.create(input)` (used by the seed and by tests; **no HTTP route** — no unauthenticated writes exist anywhere). `create` inserts the brand and the `catalog.brand.created` outbox row in one transaction; a `UNIQUE (slug)` violation is mapped to `ConflictError('CATALOG_BRAND_SLUG_TAKEN')`.
- **Infrastructure:** `brands` table (§6.3), `DrizzleBrandRepository` (plain `INSERT`; no `ON CONFLICT`).
- **API:** `GET /catalog/brands?page=1&pageSize=20` (`pageSize` ≤ 100) → `{ items, page, pageSize, total }` ordered by `name COLLATE "fa"`, tie-break `id`; an invalid query → `400` problem `VALIDATION_FAILED` with `errors[]`. `GET /catalog/brands/:slug` → `Brand` or `404` problem `CATALOG_BRAND_NOT_FOUND`.
- **Seed** (`apps/api/src/seed.ts`, booted with `NestFactory.createApplicationContext`, relay not started): six brands with Latin slugs and Persian names — `optimum-nutrition` «اپتیموم نوتریشن», `dymatize» «دایماتایز», `nutrex` «نوترکس», and three whose names contain ZWNJ on purpose: `muscletech` «ماسل‌تک», `bsn` «بی‌اس‌ان», `myprotein` «مای‌پروتئین». Idempotent at the application level: for each fixture the seed calls `BrandService.getBySlug` and skips existing slugs; otherwise `BrandService.create`. Re-running writes no rows and emits no events; the seed never issues raw inserts.

### 5.8 Authentication — designed, not built

Recorded in `north-star.md` for the future `identity` spec: phone-number OTP login (E.164, per-phone and per-IP throttling — which is why the API must see the real client IP, §7.4), hashed single-use codes with TTL, short-lived JWT access token in an `httpOnly; Secure; SameSite=Lax` cookie, opaque rotating refresh token stored hashed in Postgres, `Role` enum + `RolesGuard`, admin accounts require password + OTP. Cookies carry **no `Domain`** attribute so a later direct browser→API path is additive. Nothing from this section is scaffolded at foundation.

## 6. Data layer

### 6.1 Engine and driver

PostgreSQL 16 in every environment (local compose, CI Testcontainers, Liara). Drizzle ORM with the `pg` Pool (`max` from env, sane defaults); `drizzle(pool, { casing: 'snake_case' })` with **no `schema` option** — the relational query API (`db.query.*`) is not used, each repository imports only its own module's tables.

### 6.2 Schema ownership and migrations

- Each module owns its tables in `modules/<context>/infrastructure/schema.ts`; infra-owned tables live in `src/infra/**/schema.ts` (`outbox_events`). `apps/api/drizzle.config.ts` sets `schema: './src/**/schema.ts'` (drizzle-kit accepts globs), so there is **no aggregate schema file** and `shared-and-infra-are-leaves` holds without exceptions.
- Cross-module **database** foreign keys are allowed (integrity). A module needing one imports the other module's table object from that module's `index.ts` `tables` namespace — exported for FK declaration only, never for queries — or adds the constraint in a hand-written migration. Cross-module Drizzle `relations()` and query-level joins are **not** allowed.
- Migrations: `drizzle-kit generate` produces SQL under `apps/api/drizzle/` (committed, reviewed in PRs). Migration `0000_extensions` is created with `drizzle-kit generate --custom --name=extensions` and enables `pg_trgm` and creates `COLLATION fa (provider = icu, locale = 'fa')`. **Before the first production migration** `first-deploy.md` runs `SELECT count(*) FROM pg_collation WHERE collprovider = 'i'` on the Liara database; if it is 0, the collation is replaced by ordering on `search_text` (ADR).
- `src/migrate.ts` wraps drizzle's `migrate()` in `pg_advisory_lock(<fixed key>)` / `pg_advisory_unlock` so overlapping starts serialise, and exits non-zero on error (Liara then keeps the previous release serving). Applied by `infra/docker/entrypoint.sh` when `PROCESS_ROLE` is `api` or `all` (§5.2). Because old and new containers overlap during a zero-downtime rollover, migrations must be expand/contract compatible with the previous release; `healthCheck.startPeriod` and `HEALTHCHECK --start-period` are ≥ 60 s. If a `files` field is ever added to `apps/api/package.json` it must include `drizzle`.

### 6.3 Conventions (also encoded in `.claude/rules/db.md`)

| Convention | Rule |
|---|---|
| Names | snake_case tables and columns derived by `casing` from camelCase keys; plural table names |
| Primary keys | `id uuid` = UUIDv7 generated in application code; ledgers/outbox use `bigint generated always as identity` |
| Timestamps | `createdAt`, `updatedAt` as `timestamptz`, UTC only; `updatedAt` set by application code. Jalali is a display concern (§7.3) |
| Money | `amountMinor bigint` + `currency char(3)` (`IRR`); never Toman in storage, never floats; the shared `Money` value object (construct, add, compare, multiply by an integer — allocation arrives with pricing) |
| Persian text | normalized **on write in the domain entity** (`normalizePersian`: Arabic ي/ك → Persian ی/ک, Persian/Arabic digits → ASCII) — HTTP inputs are additionally normalized by the `persianText` contract preprocess, so both paths agree. `brands.name` carries the search pattern: `search_text text GENERATED ALWAYS AS (replace(name, chr(8204), ' ')) STORED` with `USING gin (search_text gin_trgm_ops)`; test: inserting «ماسل‌تک» yields `search_text = 'ماسل تک'`; `ORDER BY name COLLATE "fa"` |
| Human-facing ids | products (later) get a `publicId bigint` sequence for URLs; UUIDs stay internal |
| Soft delete | `deletedAt` only on rows that order history will reference; hard-delete everything else |
| Concurrency | `version integer` optimistic locking where contention exists (inventory, later); conditional single-statement updates for stock |
| Constraints | invariants as `CHECK`/`UNIQUE`/partial unique indexes, not only in code |

### 6.4 Transactions

Explicit: services open `db.transaction(async (tx) => …)` and pass the executor to repositories (`repo.create(brand, tx)`). No CLS/AsyncLocalStorage magic at foundation — visible transactions are what agents get right.

### 6.5 Redis and object storage

- Redis 7.2 via ioredis (`lazyConnect: true`): throttler storage now; a `KeyValueStore` port (`get/set/del` with TTL) for OTP, idempotency and cache later, with one integration test so it is not untested code. Readiness check pings Redis.
- `StorageProvider` port (`put`, `getSignedUrl`, `delete`, `head`) over `@aws-sdk/client-s3` with `forcePathStyle: true`, endpoint/region/bucket/keys from env. RustFS locally and in the integration suite; Liara object storage (`https://storage.iran.liara.site`, region `default`) in production. A put/get/delete smoke test runs in the integration suite against RustFS (path-style, `region: default`, mirroring Liara's settings); the same test is runnable as `pnpm --filter api test:storage` with `S3_*` taken from the operator's shell, and `first-deploy.md` runs it once against Liara with a key scoped to the production bucket. **Production `S3_*` values never enter GitHub secrets.** No upload endpoints.

### 6.6 Test data and isolation

Domain tests need no database. The integration project (`vitest.integration.config.ts`, `fileParallelism: false`) starts three Testcontainers once per run in global setup — `postgres:16`, `redis:7.2-alpine`, `rustfs/rustfs` (bucket created in setup) — writes `DATABASE_URL`, `REDIS_URL` and `S3_*` into `process.env`, and applies migrations. Isolation is by truncation: `beforeEach` runs `TRUNCATE brands, outbox_events RESTART IDENTITY CASCADE` (extended per module) and Redis `FLUSHDB`. Transaction-rollback isolation is **not** used because HTTP (`app.inject()`) and relay tests run against the app's own pool and transactions, and the relay must read committed rows.

## 7. Storefront (`apps/web`)

### 7.1 Configuration

Next.js 16.3.3 or later (the release fixing two critical RCEs), React 19.2, Turbopack. `next.config.ts`: `reactCompiler: true`, `cacheComponents: true`, `output: 'standalone'`, `outputFileTracingRoot` at the repo root. No `proxy.ts`, no image configuration, no manifest, no service worker at foundation. `NEXT_PUBLIC_SITE_URL` is a **build-time** input (inlined and baked into prerendered metadata/robots): `Dockerfile.web` declares `ARG NEXT_PUBLIC_SITE_URL` + `ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL` before `turbo run build`; `infra/liara/web.json` passes it in `build.args` (a public value, safe to commit); the CI `e2e` and `docker` jobs pass the same `--build-arg`; changing it requires a rebuild. **Acceptance:** `pnpm --filter web build` succeeds with `API_INTERNAL_URL=http://127.0.0.1:9` (unreachable API) — nothing reachable from the static shell calls the API at build time (§7.5).

### 7.2 RTL and Persian rendering

- `app/layout.tsx` renders `<html lang="fa" dir="rtl">` unconditionally.
- Tailwind CSS 4.3 with **logical utilities only** (`ms- me- ps- pe- start- end- inset-s- text-start`). An ESLint `no-restricted-syntax` rule fails the build on physical direction classes (`ml- mr- pl- pr- left- right- text-left text-right`). The `rtl:` variant is reserved for mirroring directional icons.
- shadcn 4.19 initialized with `pnpm dlx shadcn@<pinned> init --rtl -b base` → `components.json` `rtl: true`, Base UI primitives, `DirectionProvider` in the root layout, `dir="rtl"` passed explicitly to portal components (tw-animate-css RTL bug).
- **Vazirmatn** variable woff2 (SIL OFL) vendored in `apps/web/app/fonts/` and loaded with `next/font/local` (`weight: '100 900'`, `display: 'swap'`, `variable: '--font-vazirmatn'`, Tahoma/Arial fallbacks) → Tailwind `--font-sans`. `font-feature-settings: "ss01"` where raw digits render Persian, `"tnum"` on price columns; `letter-spacing: 0` on Persian text; `next/font/google` is banned by lint.

### 7.3 `@ds/persian` — the only place normalization, validation and formatting live

`normalizePersian`, `toAsciiDigits`, `toPersianDigits`, `formatNumber`, `formatToman(amountMinorIRR)` (÷10, grouping, Persian digits, "تومان"), `formatJalali(date, style)` via `Intl.DateTimeFormat('fa-IR', { calendar: 'persian', timeZone: TEHRAN_TZ })`, `TEHRAN_TZ = 'Asia/Tehran'` as the single constant, and validators (`isIranMobile`, `isNationalId`, `isPostalCode`, `isSheba`) wrapping `@persian-tools`. Consumed by `@ds/contracts` (preprocess + refinements), `apps/api` (entity normalization) and `apps/web` (formatting). Formatting happens **on the server** to avoid ICU hydration mismatches.

### 7.4 Data access boundary

**The Next.js server is the only caller of the API at foundation.** `@ds/api-client/server` exports two entries:

- `publicApi` — no request context; must not read `headers()`/`cookies()` anywhere in its call chain (openapi-fetch middleware included). Used inside `'use cache'` scopes; cached pages are keyed by URL only. (Next.js rejects request APIs inside `'use cache'` **at request time**, not at build time.)
- `requestApi()` — async; reads `headers()`/`cookies()`; forwards `Cookie`, `x-request-id`, and sets `X-Forwarded-For` to the single end-user IP resolved from the trusted edge header (ArvanCloud's real-IP header — name and origin-bypass protection confirmed in `go-live.md`), never the raw incoming header. Used only in dynamic scopes (future cart/account/actions).

Reads: Server Components → `@ds/api-client/server` (`server-only`, `React.cache()`-deduped) → `fetch(API_INTERNAL_URL)` over Liara's private network. Writes (future): Server Actions through `requestApi()`, then `updateTag`/`revalidateTag`; auth re-checked inside every action. The browser never calls Nest directly: one origin, no CORS, simple cookies. Because API cookies carry no `Domain`, a direct browser→API path can be added later without breaking anything. TanStack Query is not installed until client-only/polled data exists.

### 7.5 Rendering strategy (documented in `.claude/rules/web.md`; the reference slice demonstrates it)

| Page type | Strategy |
|---|---|
| Listings, brand pages (now) | The page itself is **uncached**; it renders the static shell and a `<Suspense>` boundary whose server component first `await connection()` (from `next/server`) and then calls a `'use cache'` data function (`getBrands()` / `getBrand(slug)` in `apps/web/lib/catalog.ts`, `cacheLife('hours')`, `cacheTag('catalog', …)`) through `publicApi`. Result: the shell prerenders at build with no API, data is cached at runtime and shared across users, and nothing calls the API during `next build` |
| Product detail (later) | same shape; price/stock streamed in a second Suspense island |
| Cart, checkout, account (later) | fully dynamic, `requestApi()` |
| `app/sitemap.ts` | `await connection()` then an **uncached** `publicApi.GET('/catalog/brands')` (never the cached function — it would run at build) |
| `app/health/route.ts` | `GET` → `await connection()` → `200 {"status":"ok"}` |

### 7.6 Errors

`error.tsx`, `not-found.tsx`, `global-error.tsx` with Persian copy. `@ds/api-client` turns `problem+json` into a typed `ApiError { status, code, detail, instance }`; `apps/web/lib/errors.ts` maps `code` → Persian message with a generic fallback. English never reaches the user. Note: `notFound()` raised inside a streamed Suspense boundary renders `not-found.tsx` with `<meta name="robots" content="noindex">` but an HTTP 200 (the shell already streamed); a real 404 status is deferred until `proxy.ts` exists.

### 7.7 URLs and SEO

- Brands: `/brands` and `/brands/{slug}` (Latin slugs). Products (later): `/product/{publicId}/{slug}` — the numeric `publicId` is canonical, the slug is free-form, mismatches 301 (Digikala's scheme).
- `metadataBase` from `NEXT_PUBLIC_SITE_URL`; root `generateMetadata` defaults (title template, `openGraph.locale: 'fa_IR'`); `app/robots.ts`; `app/sitemap.ts` emits `/`, `/brands` and `/brands/{slug}` for every brand (§7.5).
- `<SiteImage>`, `jsonLd()` and image configuration are **not** created at foundation (§17).

### 7.8 Reference slice in web

- `/` — RTL shell: header with the site name in Persian, font applied, one link to brands.
- `/brands` — §7.5 shape; renders the seeded Persian names (and slugs) in the API's order.
- `/brands/[slug]` — page awaits `params`; `<Suspense>` → `BrandDetail` (`await connection()`) → `getBrand(slug)` (`'use cache'`, `cacheTag('catalog', 'brand:<slug>')`) which returns `null` on `ApiError.code === 'CATALOG_BRAND_NOT_FOUND'`; the component calls `notFound()` on `null` and otherwise renders name and description. This exercises `lib/errors.ts` and `not-found.tsx`.
- `/health` — §7.5.

That is the entire UI at foundation.

### 7.9 Tests and budgets

- Vitest + Testing Library + jsdom: `@ds/persian` formatters/normalizers/validators, `@ds/contracts` schemas, `lib/errors.ts`, synchronous components.
- Playwright (`baseURL: http://localhost:3000`, api on 3001): `locale: 'fa-IR'`, `timezoneId: 'Asia/Tehran'`, one desktop and one mobile project; `@axe-core/playwright` on `/`, `/brands`, `/brands/muscletech`; asserts `dir="rtl"`, the font is applied, brand names render, `/brands/muscletech` shows «ماسل‌تک», and `/brands/no-such-brand` renders the Persian `not-found.tsx` copy with the `noindex` meta. Runs in CI against the real API and database (§10).
- Budgets (documented targets, enforced later): ≤ 130 KB compressed first-load JS per route, font ≤ 120 KB, LCP ≤ 2.5 s / INP ≤ 200 ms on "Slow 4G" + 4× CPU throttle.

## 8. Contracts and API client

### 8.1 `@ds/contracts`

Zod 4 — top-level forms only (`z.uuid()`, `z.iso.datetime()`, `z.email()`); validation results expose `issues`, never `errors`. Layout:

- `src/common/`: `id = z.uuid()`; `slug = z.string().regex(/^[a-z0-9-]+$/).max(64)`; `persianText(max: number) = z.preprocess(normalizePersian, z.string().min(1).max(max))` (factory); `iranMobile`, `nationalId`, `postalCode`, `sheba` as refinements over the `@ds/persian` validators; `PageQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) })`; `paginated(item) = z.object({ items: z.array(item), page, pageSize, total: z.number().int().nonnegative() })`.
- `src/errors/`: `ProblemDetailsSchema` (§5.5 shape) and `ErrorCode` = `VALIDATION_FAILED | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMITED | INTERNAL | CATALOG_BRAND_NOT_FOUND | CATALOG_BRAND_SLUG_TAKEN`.
- `src/catalog/brand.ts`: `BrandSchema = { id, slug, name: persianText(200), description: persianText(2000).optional(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }`; `BrandListQuerySchema = PageQuerySchema`; `BrandListResponseSchema = paginated(BrandSchema)`.

Types via `z.infer` and exported alongside. Rule: contracts describe **HTTP shapes**, never domain entities; `apps/web` never imports the API's domain.

### 8.2 `@ds/api-client`

`openapi-typescript` generates `src/generated/schema.d.ts` from `apps/api/openapi.json` (both committed; CI runs `pnpm openapi:generate` and fails on a diff). `createApiClient({ baseUrl, headers })` wraps `openapi-fetch` with middleware for header forwarding, request id, and `problem+json → ApiError`. Entry points: `.` (isomorphic factory) and `./server` (`server-only`; exports `publicApi` and `requestApi()` per §7.4, `React.cache`-deduped). Chosen over tRPC/ts-rest/oRPC because OpenAPI keeps the API consumable by the future admin app, a mobile app or partners; the Zod schemas remain the portable asset.

## 9. Local development, quality gates, dependency policy

### 9.1 Machine prerequisites

pnpm 11 (`npm i -g pnpm@<pinned>`), OrbStack (Docker), Node 24 (already present). Iranian registry mirrors are documented in `docs/runbooks/iran-mirrors.md` (Docker `registry-mirrors`, `TESTCONTAINERS_HUB_IMAGE_NAME_PREFIX` — covers all three test images, npm mirror) as opt-in machine configuration, never committed defaults.

### 9.2 `infra/compose.yaml`

`name: dubaisupp`; services `postgres:16` (named volume), `redis:7.2-alpine`, `rustfs/rustfs` (S3 on 9000, console on 9001, bucket created by an init service), `axllent/mailpit` (SMTP 1025, UI 8025). Healthchecks on all four so `up -d --wait` returns when they are usable. Ports bound to `127.0.0.1`.

### 9.3 Environment and ignore files

- Only `.env`, `.env.local` and `.env.*.local` may hold real values; they are git-ignored (`**/.env`, `**/.env.local`, `**/.env.*.local`). `.env.example` is committed per app, **never contains a secret**, holds schema-valid placeholder values, and must never match a deny rule (a Read deny also blocks Edit/Write).
- Both apps validate with Zod at boot; Turbo `envMode: strict` with every key declared in `turbo.json` `env`/`globalEnv` (Appendix B).
- `.dockerignore` and `.liaraignore` are **byte-identical** (Liara reads exactly one ignore file and `.dockerignore` is in its default-ignored list, so the upload filter must carry the same rules): `node_modules`, `.next`, `dist`, `coverage`, `docs`, `.git`, `.claude/settings.local.json`, `**/.env`, `**/.env.local`, `**/.env.*.local`. `liara deploy` is **never run from a workstation** (§10.2).

### 9.4 Quality gates, in layers

1. **On save** (Claude Code PostToolUse hook): prettier + eslint on the edited file.
2. **On commit** (lefthook `pre-commit`): prettier `--write` + eslint on staged files, `stage_fixed`. **`commit-msg`**: `pnpm exec commitlint --edit {1}` **and** `scripts/check-commit-msg.sh {1}` (`grep -Eqi 'co-authored-by|generated with|claude-session|noreply@anthropic\.com' "$1" && { echo 'AI trailer rejected'; exit 1; }; exit 0`).
3. **On push** (lefthook `pre-push`): `pnpm audit:authors && turbo run typecheck test --affected --output-logs=errors-only` (unit tests only — no Docker on the push path).
4. **`pnpm check`**: lint + typecheck + unit + integration + boundaries + sherif + docs check — every task ends green.
5. **CI** (§10), including gitleaks.

### 9.5 Dependency policy

Exact pins in the pnpm catalog. Renovate (`config:recommended`, weekly, `:semanticCommits`, `helpers:pinGitHubActionDigests`, `minimumReleaseAge: 3 days`): groups `@nestjs/*`, `next`/`react`/`eslint-config-next`, `eslint`/`typescript-eslint`, `drizzle-orm`/`drizzle-kit`; **blocks** `typescript >= 6.1` and `drizzle-orm >= 1.0` (each unblocked only by an ADR); automerges devDependency patch/minor — which works only because the author audit allowlists `renovate[bot]` (§13.4). pnpm `allowBuilds` allowlist as in §4.2; `blockExoticSubdeps` on.

## 10. CI/CD

### 10.1 `ci.yml` (pull requests and pushes to `main`)

- `actions/checkout` (`fetch-depth: 0`), `pnpm/setup` with store cache (it installs by default — no second `pnpm install`), ubuntu runners. `permissions: contents: read` (the `deploy` job below adds nothing beyond secrets); `concurrency` cancel-in-progress per ref; action SHAs pinned by Renovate. Turbo remote cache off; Turborepo's GitHub Actions detection supplies the `--affected` base on both `pull_request` and `push`.
- Job **check**: `pnpm check:affected && pnpm turbo run build --affected --output-logs=errors-only --env-mode=strict` — the same task list as `pnpm check` (so `boundaries`, `sherif` and the docs check run on every PR) plus `build`; integration tests use Testcontainers (Docker is available on ubuntu runners).
- Job **openapi**: `cp apps/api/.env.example apps/api/.env && pnpm openapi:generate && git diff --exit-code` — no service containers (§5.5).
- Job **e2e**: `postgres:16` + `redis:7.2` as services, schema-valid dummy `S3_*` values (the api refuses to boot without them; e2e never touches storage), migrate + seed, api on 3001 and web on 3000 (production builds, `API_INTERNAL_URL=http://localhost:3001`, `--build-arg`-equivalent `NEXT_PUBLIC_SITE_URL=http://localhost:3000`), Playwright, upload the HTML report.
- Job **docker** (`main` only): build both images with BuildKit cache; run the api image with `PROCESS_ROLE=all` against the service containers → `GET /health/ready` is 200; run the web image with `API_INTERNAL_URL` pointing at the api container → `GET /health` and `GET /brands` are 200.
- Job **authors**: `pnpm audit:authors` (§13.4).
- Job **secrets**: `gitleaks/gitleaks-action` (SHA-pinned) over the full history; `.gitleaks.toml` adds a generic high-entropy rule for `*_TOKEN|*_SECRET|*_KEY=` assignments and allowlists `**/.env.example`.
- Job **deploy** (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: [check, openapi, e2e, docker, authors, secrets]`, `environment: production`): §10.2. No `workflow_run` trigger anywhere — secrets are never exposed to a workflow started by a pull request.

### 10.2 Deploy (`deploy` job above; `deploy.yml` = the same steps behind `workflow_dispatch` for the first and any manual deploy)

`npm i -g @liara/cli@9`, then per app:

```
liara deploy --path . --liara-json infra/liara/api.json --platform docker --port 3000 \
  --app "$LIARA_APP_API" --api-token "$LIARA_API_TOKEN" --no-app-logs
```

(and `web.json` / `$LIARA_APP_WEB`). Liara builds the image from `build.dockerfile` with the repo root as context (private GHCR images aren't supported); `--build-location germany` is the documented fallback if base-image pulls fail on Liara's side. `--port 3000` is passed explicitly (the CLI prompts otherwise and CI would hang). Environment variables are set once with `liara env set`, never through `liara.json` `envs` (it replaces all variables). Each `liara.json` carries `healthCheck` (enables zero-downtime deploys): api `"command": "CMD wget -qO- http://127.0.0.1:3000/health/ready || exit 1"`, web `"command": "CMD wget -qO- http://127.0.0.1:3000/health || exit 1"` (BusyBox `wget` ships in `node:24-alpine`; `curl` does not), `interval 10, timeout 5, retries 3, startPeriod 60` — the units Liara's docs imply are verified in `first-deploy.md`. `web.json` also carries `build.args: ["NEXT_PUBLIC_SITE_URL=https://<domain>"]`.

### 10.3 Docker images (`infra/docker/`)

`Dockerfile.api`: `node:24-alpine` → install pnpm + turbo → `turbo prune api --docker` → install with a BuildKit store cache → build → `pnpm --filter api --prod deploy --legacy /prod/api` (redundant with `forceLegacyDeploy: true` but self-explanatory) → runtime stage `node:24-alpine`, non-root user, `ENV PORT=3000`, `HEALTHCHECK --start-period=60s` on `/health/live`, `ENTRYPOINT ["/app/entrypoint.sh"]` (§5.2). `Dockerfile.web`: same prune/build with `ARG NEXT_PUBLIC_SITE_URL`, runtime copies `.next/standalone`, `.next/static`, `public`, non-root, `HEALTHCHECK` on `/health`, `CMD node apps/web/server.js`. Both build from the repo root.

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

All Liara resources live on **one private network created before anything else** (the choice is immutable). The API's default `liara.run` subdomain is **disabled at creation** and no domain is attached; the storefront reaches it at `http://ds-api:3000` (verified from outside the network in `first-deploy.md` and recorded in ADR-0010, which also notes an `INTERNAL_API_TOKEN` header guard as the hardening to add with the first write endpoint). A separate `ds-worker` app (same image, `PROCESS_ROLE=worker`) is added when load justifies it. No staging environment at foundation.

### 11.3 Domains and DNS

- `.ir` (primary): registered **directly at nic.ir (IRNIC)** — cheapest, authoritative; requires a one-time HODA (هدا) face verification with national ID + a SIM in Saman's name.
- `.com`: bought in Rial through an Iranian reseller — **ParsPack** first choice, IranServer fallback; confirm EPP/transfer-out before purchase. Foreign registrars cannot take Iranian cards and may terminate Iran-resident accounts.
- Both domains' nameservers → ArvanCloud DNS. `.com` 301s to `.ir`. TLS at Arvan's edge plus Liara's free auto-TLS at origin.

### 11.4 Runbooks

`go-live.md`: create Liara private network → DBs → object storage bucket → apps (disable `ds-api`'s default subdomain) + env via `liara env set` → **`first-deploy.md`** (trigger `deploy.yml` via `workflow_dispatch`; verify the ICU collation query, the `TRUST_PROXY` hop assumption and the real-IP header name, the health-check units, `https://<ds-api>.liara.run` not answering, and the storage smoke test against Liara) → domains → ArvanCloud DNS/CDN → ito.gov.ir half-price registration → enamad application when ready (and, per `regulatory.md`, the supplements licensing question).

## 12. Agentic development workflow and governance

### 12.1 Instruction files

- Root `CLAUDE.md` (< 150 lines): two-line project summary; commands; the **non-negotiables** — ESM with explicit `.js` relative specifiers and `import.meta.url` (no `__dirname`/`require`); contracts are Zod only, no class-validator/DTO classes/`@ApiProperty`; logical Tailwind only; money = IRR minor units; Persian copy only in web; `catalog:` pins only, never floating majors, never `corepack enable`, packages < 24 h old need `minimumReleaseAgeExclude` (ask first); never edit `src/generated/**` or `openapi.json` by hand; every task ends with `pnpm check`; spec → plan → TDD for every feature — plus commit/branch conventions and one import `@docs/architecture/north-star.md`.
- `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `packages/contracts/CLAUDE.md` — loaded on demand, each ≤ 60 lines, pointing at the reference slice as the template.
- `.claude/rules/*.md` with `paths:` frontmatter and these minimum contents: `api.md` (`apps/api/**`) — Fastify adapter options, no `ValidationPipe`, no global prefix or URI versioning, no `MiddlewareConsumer` (guards/interceptors/`fastify.addHook`), terminus `HealthIndicatorService`, no `@nestjs/event-emitter`, Vitest + `app.inject()` (no supertest, no Jest globals); `web.md` (`apps/web/**`) — no route segment configs (`dynamic`/`revalidate`/`fetchCache`), `cacheLife`/`cacheTag` from `next/cache`, `connection` from `next/server`, `params`/`searchParams` awaited inside `<Suspense>`, `publicApi` vs `requestApi()`, `next/font/local` only, `eslint .` (no `next lint`); `contracts.md` — Zod 4 top-level forms, `issues` not `errors`; `db.md` (`**/infrastructure/schema.ts`, `apps/api/drizzle/**`, `src/infra/**/schema.ts`) — camelCase keys with `casing` deriving names, `drizzle-kit generate` + committed SQL, never `push`, §6.3 conventions; `persian.md` (`packages/persian/**`, `packages/contracts/**`, `apps/web/**`); `security.md`; `testing.md` (`**/*.test.ts`, `**/*.test.tsx`, `**/e2e/**`) — unit vs integration split, truncation isolation, `runOnce()`; `generated.md` (`**/src/generated/**`, `**/openapi.json`); `docs.md` (`docs/**`) — "introducing a term or decision → update glossary/ADR".
- `AGENTS.md`: a single line pointing at `CLAUDE.md`.

### 12.2 `.claude/settings.json` (committed)

- `"attribution": { "commit": "", "pr": "", "sessionUrl": false }`.
- `permissions.defaultMode: "acceptEdits"`. **Allow**: `Bash(pnpm check*)`, `Bash(pnpm check:*)`, `Bash(pnpm lint*)`, `Bash(pnpm typecheck*)`, `Bash(pnpm test*)`, `Bash(pnpm build*)`, `Bash(pnpm dev*)`, `Bash(pnpm db:*)`, `Bash(pnpm openapi:generate*)`, `Bash(pnpm format*)`, `Bash(pnpm install)`, `Bash(pnpm audit:authors*)`, `Bash(git status *)`, `Bash(git diff *)`, `Bash(git log *)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(gh pr view *)`, `Bash(gh pr create *)`, `WebFetch(domain:docs.nestjs.com)`, `WebFetch(domain:nextjs.org)`, `WebFetch(domain:orm.drizzle.team)`. **Ask**: `Bash(git push *)`, `Bash(pnpm add *)`, `Bash(pnpm install *)`, `Bash(pnpm remove *)`, `Bash(pnpm update *)`, `Bash(pnpm --filter *)`. **Deny**: `Read(.env)`, `Read(.env.local)`, `Read(.env.*.local)` (bare filenames match at any depth; `.env.example` stays readable and editable), `Read(./**/dist/**)`, `Read(./**/.next/**)`, `Read(./**/coverage/**)`, `Edit(./pnpm-lock.yaml)`, `Bash(pnpm dlx *)`, `Bash(pnpm exec *)`, `Bash(pnpm publish *)`, `Bash(git commit *--no-verify*)`, `Bash(git commit *-n *)`, `Bash(curl *)`, `Bash(wget *)`, `Bash(rm -rf *)`. Limitation recorded in §18: Read denies cover Claude's file tools and recognised shell readers, not arbitrary subprocesses; `sandbox` is deferred because Docker cannot run inside it.
- Hooks: `PreToolUse` on `Bash` with `if: "Bash(git commit *)"` → `.claude/hooks/no-ai-trailers.sh` (reads the hook JSON on stdin, extracts `.tool_input.command` with `jq`, exits 2 with a reason on any AI trailer pattern); `PostToolUse` on `Edit|Write` → `.claude/hooks/format-and-lint.sh` (prettier, then eslint for `.ts/.tsx`; exits 0 for other files); `Stop` → `.claude/hooks/verify.sh` (exits 0 immediately when `stop_hook_active`; otherwise `pnpm turbo run typecheck test --affected --output-logs=errors-only` — unit tests only, the same command as `pre-push` minus the audit — and exits 2 with the last 40 lines on failure).
- `.claude/agents/reviewer.md`: read-only reviewer (Read/Grep/Glob/Bash) scoped to correctness, security, module boundaries, RTL/Persian, requirement gaps.
- `.claude/skills/`: `adr` (creates `docs/decisions/NNNN-title.md` from `0000-template.md`), `new-api-module` (copies the catalog anatomy into a new context with names replaced; verified in DoD 6), `new-web-route`, `verify` (runs `pnpm check` and summarizes). Side-effect skills set `disable-model-invocation: true`.
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
| 0010 | Hosting on Liara + ArvanCloud; API not publicly exposed; Liara-built images |
| 0011 | No online payment at launch; WhatsApp handoff seam in checkout |
| 0012 | Human-only git attribution (plus Renovate) and its enforcement |
| 0013 | Public repository with rulesets on `main` |

## 13. Git, GitHub, attribution

### 13.1 Repository

`github.com/samanhoseinpour/dubai-supplement`, **public** (D7). Local checkout `~/Desktop/dubai-supplement`. Created with `gh repo create --public` from the local repository after the author audit passes and after Saman has reviewed `docs/**` for personal or regulatory detail (§19.2); the first push contains docs, `.claude/**`, the root `package.json` and `scripts/` — no application code.

### 13.2 Identity

Repository-local `user.name "Saman Hoseinpour"` and `user.email` = the address chosen in §19.1 — recommended: the GitHub noreply address (`<ID>+samanhoseinpour@users.noreply.github.com`) with "Keep my email addresses private" and "Block command line pushes that expose my email" enabled; the alternative is a verified personal address. The address is written in exactly one place, `scripts/audit-authors.allowed`. Decide before the first push; public history is not rewritten afterwards. Optional, recommended: SSH commit signing (`gpg.format ssh`, `commit.gpgsign true`, the same key uploaded as a *signing* key) for the "Verified" badge.

### 13.3 Branching and protection

Trunk-based: `main` plus short-lived `feat/*`, `fix/*`, `chore/*`, `docs/*`; squash merges; conventional commit titles. GitHub **ruleset on `main`**: require a pull request, require the `check`, `openapi`, `e2e`, `authors` and `secrets` status checks, block force-pushes and deletions; repository admin may bypass for emergencies. PR template checklist: spec/plan linked · tests added · `pnpm check` green · no AI trailers · docs/ADR updated if a term or decision was introduced.

### 13.4 Attribution enforcement, three layers

1. Claude Code `attribution` settings (project and user level) — the text is never generated.
2. `PreToolUse` hook and lefthook `commit-msg` hook — blocked if it appears anyway.
3. `pnpm audit:authors` (`scripts/audit-authors.sh`): on pull requests scans `git log --no-merges origin/main..HEAD` (the checkout is GitHub's synthetic merge commit, so merges are excluded); on pushes and locally scans `git log --no-merges main`; `--all` is never used. Every `%an <%ae>` must match a line of `scripts/audit-authors.allowed` — Saman's identity and `renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>` (dependency bumps only). The `%B` scan for `co-authored-by` / `generated with` / `claude-session` / `noreply@anthropic.com` applies to every commit including Renovate's. Author only, never committer (squash merges are committed by `GitHub <noreply@github.com>`). Runs in the CI `authors` job and in `pre-push`. The Claude GitHub App/Action is never installed for commits.

## 14. Reference slice — end-to-end data flow

1. `@ds/contracts` `src/catalog/brand.ts` defines `BrandSchema`, `BrandListQuerySchema`, `BrandListResponseSchema` (§8.1) on top of `@ds/persian`.
2. `apps/api` `catalog` module: `GET /catalog/brands` validates the query with `@Query({ schema: BrandListQuerySchema })`, calls `BrandService.list`, which calls `BrandRepository.list(tx?)` (Drizzle, `ORDER BY name COLLATE "fa", id`), and returns a `BrandListResponse` declared with `@ApiZodResponse(200, BrandListResponseSchema)`. `GET /catalog/brands/:slug` throws `NotFoundError('CATALOG_BRAND_NOT_FOUND')` → `404 problem+json`.
3. `pnpm openapi:generate` → `apps/api/openapi.json` → `@ds/api-client/src/generated/schema.d.ts`.
4. `apps/web/app/brands/page.tsx` (uncached) → `<Suspense>` → `BrandList` (`await connection()`) → `getBrands()` (`'use cache'`, `cacheLife('hours')`, `cacheTag('catalog')`, via `publicApi`) → renders names RTL in Vazirmatn. `apps/web/app/brands/[slug]/page.tsx` → `BrandDetail` → `getBrand(slug)` → `notFound()` on `null` (§7.8).
5. `pnpm db:seed` inserts the six brands through `BrandService.create` (skipping existing slugs); each create writes the brand row and its `catalog.brand.created` outbox row in one transaction; `OutboxRelay.runOnce()` dispatches to a logging handler.
6. Tests: contracts (parse + normalization through `persianText`), domain (invariants, entity normalization), integration (repository, `app.inject()` for both routes and the 400/404 problems, CORS/`X-Forwarded-For`/throttle assertions, `KeyValueStore`, outbox `runOnce()` success/retry/park, storage put/get/delete), web unit (persian formatters, `lib/errors.ts`), Playwright (§7.9).

## 15. Testing strategy summary

| Level | Tool | Lives in | Needs |
|---|---|---|---|
| Unit (domain, contracts, persian, web lib, components) | Vitest (`test` task) | colocated `*.test.ts(x)` | nothing |
| Integration (repositories, HTTP via `app.inject()`, outbox, KV, storage) | Vitest + Testcontainers (`test:integration` task) | `apps/api/test/integration/` | Docker (Postgres, Redis, RustFS) |
| End-to-end | Playwright + axe | `apps/web/e2e/` | api + db (compose locally, services in CI) |
| Static | ESLint, typescript, dependency-cruiser, sherif, docs check | `pnpm check` | nothing |

commitlint runs in the `commit-msg` hook, not in `pnpm check`. TDD is the default for every task in the plan (failing test → minimal code → refactor); the reference slice is built that way so agents see the pattern.

## 16. Definition of done (foundation)

1. `pnpm install`, `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` bring up api (3001) and web (3000); `/brands` renders the six seeded Persian names right-to-left in Vazirmatn; `/brands/muscletech` renders «ماسل‌تک»; `/brands/no-such-brand` renders the Persian not-found copy.
2. `pnpm check` is green locally; the CI `check` job runs the same tasks; `ci.yml` is green on GitHub (check, openapi, e2e, docker, authors, secrets).
3. `openapi.json` and the generated client are current (CI-enforced).
4. Outbox `runOnce()` (success, retry, park) and S3 smoke tests pass in the integration suite.
5. Both Docker images build in CI; the api image with `PROCESS_ROLE=all` answers `GET /health/ready` 200; the web image answers `GET /health` and `GET /brands` 200 against it.
6. Docs and agent config are verified by `scripts/check-docs.sh` (every file listed in §4.1 `docs/`, `.claude/**`, `.github/**` and `scripts/` exists; `CLAUDE.md` < 150 lines and each package `CLAUDE.md` ≤ 60; every ADR has the three MADR headings; every relative link resolves; hook scripts pass `shellcheck`; `.mcp.json` contains no literal key), plus: the `adr` skill produced ADR-0001; `new-api-module` run with a throwaway name yields a module that passes `pnpm check` (then deleted); `lefthook install` has run and a test commit containing `Co-Authored-By:` is rejected locally.
7. `pnpm audit:authors` passes (only allowlisted authors, zero AI trailers); repository pushed to `github.com/samanhoseinpour/dubai-supplement` with the `main` ruleset enabled.
8. ADR-0001 records the Nest 12 spike outcome.
9. `pnpm --filter web build` succeeds with an unreachable `API_INTERNAL_URL`.

## 17. Out of scope (each gets its own spec)

Products/variants/categories beyond Brand, inventory, cart, checkout and the WhatsApp handoff, OTP/identity, admin app, media pipeline (uploads, sharp variants, CDN loader, `images.*` config, `NEXT_PUBLIC_MEDIA_URL`, `<SiteImage>`), SEO helpers (`jsonLd()`, `schema-dts`), PWA manifest, search (Meilisearch), promotions, SMS/notifications, payments (Zibal/PayStar adapters), enamad application, analytics/observability (Umami, GlitchTip), staging environment, BullMQ, TanStack Query, `packages/ui`, `money` contract schema, Claude Code `sandbox`, a real 404 status for streamed not-found pages (`proxy.ts`).

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| NestJS 12 is days old; third-party peer lag; agents emit CJS/class-validator/Express patterns | Spike with a fallback (§5.1); `.claude/rules/api.md`; typecheck under `nodenext` fails on bad specifiers; dependency-cruiser; ESLint `no-restricted-imports` |
| TypeScript 7 / Drizzle 1.0 / Next majors landing mid-project | Exact pins; Renovate blocks; ADR required to unblock |
| Iranian network: Liara's build host or domestic servers losing access to npm/Docker Hub/GitHub | Nothing fetched at runtime; lockfile + vendored font; `--build-location germany` fallback; the same Dockerfiles built in CI on every `main` push; mirrors runbook |
| Liara has no Postgres 17/18 or Valkey; ICU build unverified | PG 16 + Redis 7.2 everywhere; UUIDv7 in code; ICU check before the first migration with a documented fallback |
| Public repository leaks a secret | env files git-ignored and Read-denied for Claude's file tools and recognised shell readers (arbitrary subprocesses are not covered until `sandbox` is adopted — deferred because Docker cannot run inside it); `.mcp.json` env expansion; gitleaks in CI; GitHub push protection as a second net |
| Public repository exposes business/regulatory analysis under the owner's name | Saman decides before the first push whether `docs/research/` stays committed (§19.2) |
| `ds-api` reachable from the internet despite the design | Default subdomain disabled and verified from outside; `INTERNAL_API_TOKEN` guard recorded as the next hardening step |
| Supplements sold online without an FDO/pharmacy licence (Iran FDA, 13 Jun 2026) | Business risk owned by Saman; recorded in `docs/regulatory.md`; the WhatsApp handoff keeps the site catalogue-first |
| ICU differences between Node versions cause hydration mismatches | Format on the server only; pinned Node 24 in every environment |
| Solo dev + public repo without paid plan | Rulesets available on public repos; hooks + CI as the real guard |
| Currency volatility / rial redenomination | IRR minor units; display unit configurable; noted in `regulatory.md` |

## 19. Manual actions and decisions only Saman can take (tracked in the plan)

1. **Commit identity:** choose the GitHub noreply address (recommended) or confirm `samangithoseinpour@gmail.com` is verified on GitHub; it is recorded once in `scripts/audit-authors.allowed` and the existing local commits are re-authored to match before the first push.
2. **Research documents public or private:** `docs/research/` contains analysis of sanctions/ToS exposure and regulatory risk under Saman's name. Default: keep it committed (public). Alternative: move it to a private location and reference it from `north-star.md` by title and date.
3. Install pnpm 11 and OrbStack; optionally configure Iranian registry mirrors.
4. Create the GitHub repository (the plan runs `gh repo create --public` with Saman present) and enable the `main` ruleset and push protection.
5. Liara account, private network, DBs, storage, apps (disable the api subdomain), API token → `LIARA_API_TOKEN`, `LIARA_APP_API`, `LIARA_APP_WEB` secrets; run `first-deploy.md`.
6. ArvanCloud account (DNS/CDN); confirm the real-IP header name.
7. HODA verification + `.ir` at nic.ir; `.com` at ParsPack; nameservers → ArvanCloud.
8. Context7 API key in the local environment (optional).

## Appendix A — Version pins (starting values, verified on npm 2026-08-27)

TypeScript 6.0.3 · pnpm 11.24.0 · Turborepo 2.10.12 · `@nestjs/*` 12.0.1 · `@nestjs/cli` 12.0.0 · `@nestjs/swagger` 12.0.0 · `@nestjs/config` 12.0.0 · Fastify 5.12.1 · `@fastify/helmet` 13.1.1 · `@fastify/cookie` 11.1.2 · `@nestjs/terminus` 11.1.1 · `@nestjs/throttler` 6.5.0 · `@nest-lab/throttler-storage-redis` 1.2.0 · nestjs-pino 4.6.1 · pino 10.3.1 · Zod 4.4.3 · zod-openapi 6.0.1 · drizzle-orm 0.45.2 · drizzle-kit 0.31.10 · pg 8.23.0 · ioredis 5.11.1 · Next 16.3.3 · React 19.2.8 · Tailwind 4.3.3 · shadcn 4.19.0 · `@base-ui/react` 1.7.0 · lucide-react 1.34.0 · `@persian-tools/persian-tools` 4.0.4 · Vitest 4.1.11 · Testcontainers 12.1.0 · Playwright 1.62.1 · `@axe-core/playwright` 4.13.0 · ESLint 10.9.1 · typescript-eslint 8.68.0 · eslint-plugin-boundaries 7.2.0 · dependency-cruiser 18.2.0 · Prettier 3.9.6 · sherif 1.13.0 · lefthook 2.1.10 · commitlint 21.2.2 · openapi-typescript 7.13.0 · openapi-fetch 0.17.0. Packages whose patch is resolved at install time and then pinned: `uuid`, `server-only`, `tsx`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitest/coverage-v8`, `pino-pretty`, `babel-plugin-react-compiler`, `@aws-sdk/client-s3`, `@next/playwright`, `eslint-config-next`, `prettier-plugin-tailwindcss`. `pnpm-workspace.yaml` `catalog:` is the source of truth thereafter.

## Appendix B — Environment variable inventory (every key declared in `turbo.json`)

| App | Variable | Purpose |
|---|---|---|
| api | `NODE_ENV`, `PROCESS_ROLE` (`api`/`worker`/`all`; `.env.example` = `all`), `PORT` (`3001` in `.env.example`; `3000` inside the container via `ENV PORT=3000`), `LOG_LEVEL` | runtime |
| api | `DATABASE_URL`, `DATABASE_POOL_MAX` | Postgres |
| api | `REDIS_URL` | Redis |
| api | `S3_ENDPOINT`, `S3_REGION` (`default`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` (`true`) | object storage |
| api | `CORS_ORIGINS` (optional; default empty = CORS disabled), `TRUST_PROXY` (hop count or CIDR list; `1`) | HTTP |
| api | `OUTBOX_POLL_MS` (`1000`) | relay |
| api | `OPENAPI_UI_ENABLED` (`true` in `.env.example`, unset in production) | docs |
| web | `NODE_ENV`, `PORT` (`3000` everywhere), `API_INTERNAL_URL` (`http://ds-api:3000` in prod, `http://localhost:3001` locally) | runtime |
| web | `NEXT_PUBLIC_SITE_URL` | **build-time** (inlined; passed as a Docker build arg) |
| CI | `LIARA_API_TOKEN`, `LIARA_APP_API`, `LIARA_APP_WEB` | deploy (`environment: production`) |
| local only | `CONTEXT7_API_KEY` | MCP |
