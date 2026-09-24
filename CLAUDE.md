# Dubai Supplement

Persian-language (fa-IR, RTL) e-commerce for gym and fitness supplements.
NestJS 12 ESM on the Fastify adapter (`apps/api`) plus a Next.js 16 App
Router storefront (`apps/web`), in a pnpm + Turborepo monorepo.

## Commands

| Command                 | Does                                                |
| ----------------------- | --------------------------------------------------- |
| `pnpm dev`              | api on 3001 (web arrives in Phase 3)                |
| `pnpm db:up`            | Postgres, Redis, RustFS, Mailpit via compose        |
| `pnpm db:migrate`       | apply SQL migrations                                |
| `pnpm openapi:generate` | regenerate `openapi.json` and the typed client      |
| `pnpm check`            | **the** verification command — end every task green |

## Non-negotiables

- **ESM.** Explicit `.js` on relative specifiers, `import.meta.url` for
  paths. Never `__dirname`, never `require`.
- **Contracts are Zod only.** No class-validator, no class-transformer, no
  DTO classes, no `@ApiProperty`.
- **Logical Tailwind utilities only** — `ms- me- ps- pe- start- end-
text-start`. Physical classes fail lint. The `rtl:` variant is for
  mirroring directional icons, not layout.
- **Money is IRR minor units.** `amountMinor bigint` plus `currency`. Never
  Toman in storage, never a float.
- **Persian copy lives only in `apps/web`.** The API speaks English.
- **`catalog:` pins only.** Never a floating major. Never `corepack enable`.
  A package under 24 h old trips `minimumReleaseAge` — prefer the newest
  mature version; ask before adding a `minimumReleaseAgeExclude`.
- **Never hand-edit** `**/src/generated/**` or `openapi.json`.
- **Spec → plan → TDD** for every feature. No production code without a
  failing test you watched fail.
- **Every task ends with `pnpm check`.**

## Boundaries

`apps/*` may use `packages/*`; packages never use apps. `apps/web` never
imports from `apps/api`, not even types. A module is reachable only through
its `index.ts`. `domain/**` is pure TypeScript. `application/**` may not
import `infrastructure/**`. `shared/**` and `src/infra/**` never import
`modules/**`. All of it is enforced by `dependency-cruiser`,
`eslint-plugin-boundaries` and pnpm's isolated `node_modules`.

## Commits and branches

Conventional commits. Scopes: `api web contracts api-client persian config
docs infra ci deps`. Trunk-based — short-lived `feat/*`, `fix/*`, `chore/*`,
`docs/*`, squash-merged.

**Every commit is authored solely by Saman Hoseinpour.** No
`Co-Authored-By`, no "Generated with" footer, no bot attribution. This is
enforced in three places and a violation fails CI.

@docs/architecture/north-star.md
