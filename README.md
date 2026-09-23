# Dubai Supplement

A Persian-language (fa-IR, right-to-left) e-commerce storefront for gym and
fitness supplements.

> **Status: foundation.** The repository, toolchain, quality gates and
> documentation system exist. Product features do not yet.

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| API        | NestJS 12 (ESM) on the Fastify adapter                        |
| Storefront | Next.js 16 App Router, React 19, Cache Components             |
| Contracts  | Zod 4 → OpenAPI → a typed `openapi-fetch` client              |
| Data       | PostgreSQL 16 with Drizzle ORM; Redis 7.2                     |
| UI         | Tailwind CSS 4 (logical utilities only), shadcn/ui, Vazirmatn |
| Monorepo   | pnpm 12 workspaces, Turborepo                                 |
| Testing    | Vitest 5, Testcontainers, Playwright with axe                 |
| Language   | TypeScript 6.0.3 throughout                                   |

## Prerequisites

- Node.js 24 (`.node-version`)
- pnpm 12 — `npm i -g pnpm@12.5.1`
- Docker via OrbStack, for the local database and the integration suite
- `shellcheck` and `jq`, used by `pnpm check` and the agent hooks

## Quickstart

```sh
pnpm install     # installs dependencies and the git hooks
pnpm db:up       # Postgres, Redis, object storage, mail catcher
pnpm db:migrate
pnpm db:seed
pnpm dev         # api on :3001, storefront on :3000
```

Verify everything with one command:

```sh
pnpm check
```

## Layout

| Path        | Contains                                                  |
| ----------- | --------------------------------------------------------- |
| `apps/api`  | NestJS API (arrives in Phase 2)                           |
| `apps/web`  | Next.js storefront (Phase 3)                              |
| `packages/` | Shared contracts, Persian utilities, API client, configs  |
| `infra/`    | Local compose stack, Dockerfiles, deploy manifests        |
| `docs/`     | Architecture, decisions, glossary, runbooks, specs, plans |
| `scripts/`  | Repository checks run by `pnpm check` and the git hooks   |

## Documentation

- [Architecture north star](docs/architecture/north-star.md) — contexts,
  dependency directions, invariants, non-goals
- [Foundation design](docs/superpowers/specs/2026-08-27-foundation-design.md)
- [Decision records](docs/decisions/)
- [Glossary](docs/glossary.md) — the Persian ↔ English ubiquitous language
