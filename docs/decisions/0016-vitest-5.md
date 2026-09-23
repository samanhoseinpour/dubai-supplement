# 0016. Vitest 5 on the default forks pool; unplugin-swc not installed

- Status: accepted
- Date: 2026-09-23

## Context and Problem Statement

The spec pinned Vitest 4.1.11. Vitest 5.0.0 shipped 2026-09-03 and 5.0.1 on 09-15; the 4.x line has had no release since and no stated maintenance policy. Separately, the spec assumed `unplugin-swc` would be needed so NestJS constructor injection sees `design:paramtypes` in tests.

## Considered Options

- **Vitest 5.0.1** on the default `forks` pool.
- **Vitest 4.1.11**, the reviewed version.
- **Vitest 5 with `vmThreads`** for speed.

## Decision Outcome

Chosen: **5.0.1 on `forks`**. The known 5.0 regressions are confined to `vmThreads` with `isolate: false`, which this repository never enables. Starting on a line with no maintenance policy is the larger risk.

The `unplugin-swc` assumption was tested rather than inherited: on Vitest 5.0.1 with Vite 8.3.0, Oxc honours tsconfig `experimentalDecorators` and `emitDecoratorMetadata` and emits `design:paramtypes` natively, including across files. So **`unplugin-swc` is not installed**. It remains a documented escape hatch at 2.0.x if Oxc's `Object` fallback for an uncomputable type ever causes a DI failure — which would be recorded in ADR-0001.

### Consequences

- Good: One test runner on a maintained line.
- Good: One fewer build plugin in the test path.
- Good: `vite` is now an explicit dependency, so its version is pinned rather than transitive.
- Bad: `clearMocks` defaults to true in 5.0, so every config sets it explicitly.
- Bad: Config files are no longer found in parent directories — each workspace carries its own.
- Bad: `@vitest/coverage-v8` peers Vitest exactly, so the two always move together.
