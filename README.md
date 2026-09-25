# Dubai Supplement

A Persian-language (fa-IR, right-to-left) e-commerce storefront for gym and
fitness supplements.

> **Status: foundation.** The repository, toolchain, quality gates,
> documentation system, the API's foundation and the storefront's foundation
> exist — configuration, migrations, health probes, the transactional outbox,
> Redis and object storage on the API side; the shell, the two-colour design
> system, light and dark themes, the `/design` gallery and the Playwright +
> axe suite on the web side. No product feature does: the catalogue arrives
> with Phase 3b and the brand pages with 3c. The table below is the chosen
> stack, not a list of what is built.

## Stack

| Layer      | Choice                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- |
| API        | NestJS 12 (ESM) on the Fastify adapter                                                   |
| Storefront | Next.js 16 App Router, React 19, Cache Components                                        |
| Contracts  | Zod 4 → OpenAPI → a typed `openapi-fetch` client                                         |
| Data       | PostgreSQL 16 with Drizzle ORM; Redis 7.2                                                |
| UI         | Tailwind CSS 4 — two-colour tokens, logical utilities only; shadcn on Base UI; Vazirmatn |
| Monorepo   | pnpm 12 workspaces, Turborepo                                                            |
| Testing    | Vitest 5, Testcontainers, Playwright with axe                                            |
| Language   | TypeScript 6.0.3 throughout                                                              |

## Prerequisites

- Node.js 24 (`.node-version`)
- pnpm 12 — `npm i -g pnpm@12.5.1`
- Docker via OrbStack, for the local database and the integration suite
- `shellcheck` and `jq`, used by `pnpm check` and the agent hooks

## Quickstart

```sh
pnpm install                            # dependencies and the git hooks
cp apps/api/.env.example apps/api/.env  # schema-valid localhost values
cp apps/web/.env.example apps/web/.env  # local values, no secret
pnpm db:up                              # Postgres, Redis, object storage, mail catcher
pnpm db:migrate
pnpm dev                                # api on :3001, web on :3000
```

The API refuses to boot on an invalid environment, so the copies are not
optional. The storefront serves its shell and the design gallery at
`http://localhost:3000/design`; there is nothing to seed until Phase 3b.
End to end: `pnpm e2e:install` once per machine (Chromium), then `pnpm e2e`.

Verify everything with one command:

```sh
pnpm check
```

## Layout

| Path        | Contains                                                          |
| ----------- | ----------------------------------------------------------------- |
| `apps/api`  | NestJS API — config, migrations, health, outbox, storage          |
| `apps/web`  | Next.js storefront — shell, design system, `/design` gallery, e2e |
| `packages/` | Shared contracts, Persian utilities, shared configs               |
| `infra/`    | Local compose stack, Dockerfiles, deploy manifests                |
| `docs/`     | Architecture, decisions, glossary, runbooks, specs, plans         |
| `scripts/`  | Repository checks run by `pnpm check` and the git hooks           |

## Documentation

- [Architecture north star](docs/architecture/north-star.md) — contexts,
  dependency directions, invariants, non-goals
- [Foundation design](docs/superpowers/specs/2026-08-27-foundation-design.md)
- [Storefront foundation and design system](docs/superpowers/specs/2026-09-25-storefront-design-system-design.md)
- [Decision records](docs/decisions/)
- [Glossary](docs/glossary.md) — the Persian ↔ English ubiquitous language
