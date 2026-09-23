# 0001. NestJS 12 ESM on Fastify

- Status: accepted
- Date: 2026-09-23

## Context and Problem Statement

The foundation design (§5.1) committed to NestJS 12 ESM on the Fastify adapter but recorded it as unproven. NestJS 12.0.0 was days old when the spec was written, several third-party packages still declared `<=11` peers, and native ESM plus `emitDecoratorMetadata` is the configuration most likely to break quietly: a missing `design:paramtypes` does not fail the build, it makes dependency injection resolve `undefined` at runtime.

The spec therefore made the first `apps/api` task a time-boxed spike — sixty minutes, with a pre-agreed fallback to NestJS 11.2.x CJS plus nestjs-zod if any gate failed.

## Considered Options

- **NestJS 12 ESM on Fastify**, as designed.
- **NestJS 11.2.x CJS with nestjs-zod**, the fallback: same module anatomy, same contracts, nothing else in the spec changes.

## Decision Outcome

Chosen: **NestJS 12 ESM on Fastify**. All three gates passed in roughly eleven of the sixty minutes.

1. `pnpm install` resolved 305 packages with no peer failure.
2. `nest build` succeeded, and `dist/main.js` contains five `import`/`export` statements and **zero** `require` or `module.exports` — genuine ESM, not CommonJS wearing an `.mjs` hat.
3. `GET /health/live` returned 200 through `app.inject()`, which also proves dependency injection: `HealthCheckService` was constructor-injected into `HealthController`, so `design:paramtypes` was emitted.

Point 3 settles the spec's open question about decorator metadata. **Oxc emits it natively** under Vitest 5 / Vite 8, so `unplugin-swc` is not installed. It stays a documented escape hatch at 2.0.x.

`@nestjs/cli` is pinned at **12.0.5** and this is load-bearing. 12.0.5 carries `fix(compiler): emit es modules with swc for esm projects`; on 12.0.3 the SWC builder emits CommonJS for an ESM project, which would have presented as a spike failure having nothing to do with NestJS 12.

**`nest new` needs no prompt.** The spec assumed ESM had to be chosen interactively. The CLI's `new` command builds its schematic context from a fixed key whitelist with no `type` entry, so `--type esm` cannot be passed — but `@nestjs/schematics` declares `type` with `default: "esm"`, and schematic prompts are skipped when stdin is not a terminal. Run with stdin closed and `--no-observe`, the scaffold is fully deterministic. This matters because it makes the step reproducible by an agent.

**The one package still declaring Nest 11 peers works.** ADR-0017 required the spike to exercise `@nest-lab/throttler-storage-redis` rather than merely boot it. A throwaway module at `limit: 2` against a real Redis returned `[200, 200, 429]`, with `:hits` and `:blocked` keys visible in Redis. The peer override in `pnpm-workspace.yaml` stands, and the hand-rolled ioredis fallback is not needed. The probe was deleted afterwards — it requires Docker and the unit suite must stay Docker-free (§9.4).

### Consequences

- Good: The whole spec proceeds unchanged. No fallback, no rewrite of §5–§8.
- Good: One less dependency (`unplugin-swc`) and one less unknown (the throttler storage).
- Good: The scaffold step is non-interactive, so Phase 2 can be executed by agents without a human at the keyboard.
- Bad: The ESM + SWC path depends on a CLI fix that is one day old. A CLI downgrade silently produces CommonJS, so `@nestjs/cli` must not be moved backwards.
- Bad: `apps/api` needs both a `tsconfig.json` (broad — vitest, ESLint and the editor read it) and a `tsconfig.build.json` (narrow, `rootDir: src`, referenced by `nest-cli.json`). §5.1 said to delete the latter; it is required. With one config, either `dist/main.js` lands at `dist/src/main.js` or test files lose `experimentalDecorators` and `@Controller` fails to parse.

**Reversed if** the ESM toolchain regresses in a way that cannot be pinned around — a CLI release that breaks ESM emit with no working prior version, or a Nest 12 minor that breaks decorator metadata under Oxc. The fallback remains NestJS 11.2.x CJS with nestjs-zod, and the module anatomy in §5.3 is deliberately framework-agnostic so that swap stays mechanical.
