# apps/api — the API

NestJS 12 ESM on Fastify, Zod contracts from `@ds/contracts`, Drizzle over
Postgres 16, Redis, RustFS. English only: Persian appears here only as data
in the seed and the tests. Rules: `.claude/rules/api.md`, `db.md`, `persian.md`,
`testing.md`. Design: `docs/superpowers/specs/2026-08-27-foundation-design.md` §5–§6.

## Commands (from the repository root)

| Command                              | Does                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| `pnpm db:up` · `pnpm db:migrate`     | the four services; apply `drizzle/*.sql` under an advisory lock  |
| `pnpm db:generate --name=<name>`     | the next migration from `src/**/schema.ts`; commit the SQL       |
| `pnpm db:seed`                       | the nine brands through `BrandService`, idempotent by slug       |
| `pnpm openapi:generate`              | build, write `openapi.json`, regenerate the client's `schema.ts` |
| `pnpm test --filter=api`             | unit — no store                                                  |
| `pnpm test:integration --filter=api` | Testcontainers — needs Docker                                    |
| `pnpm check`                         | everything, `boundaries` and the openapi freshness test included |

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
- `ValidationPipe`, `class-validator`, `class-transformer`, `@nestjs/event-emitter`,
  `@nestjs/platform-express`, `__dirname`, a relative import without `.js`.
- A comment in `turbo.json`.

## The shape of a route and a write

`@Controller('catalog/brands')` → `@Get(':slug')` with
`@Param('slug', { schema: slug })` and `@ApiZodResponse(200, BrandSchema)`;
the service throws `NotFoundError('CATALOG_BRAND_NOT_FOUND', '<English>')`
and `ProblemFilter` answers `application/problem+json`. A write runs in
`db.transaction(async (tx) => …)`, passes `tx` to the repository and to
`EventPublisher.publish(event, tx)`, and never touches another module's tables.
