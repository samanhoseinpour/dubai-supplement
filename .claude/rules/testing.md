---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/e2e/**'
---

# Testing rules

- **Unit versus integration.** `test` needs nothing — domain logic,
  contracts, formatters, synchronous components. `test:integration` needs
  Docker and runs against Testcontainers.
- **Isolation is truncation, not transaction rollback.** `beforeEach` runs
  `TRUNCATE ... RESTART IDENTITY CASCADE` and Redis `FLUSHDB`. Rollback
  isolation does not work here because `app.inject()` and the outbox relay
  run against the app's own pool and must read committed rows.
- **Outbox tests call `runOnce()` directly.** Never start the relay loop and
  sleep.
- **Vitest 5 specifics:** set `clearMocks` explicitly (5.0 flipped the
  default to `true`); `vi.mock`, `vi.unmock` and `vi.hoisted` only at module
  top level; every workspace carries its own `vitest.config.ts` because
  parent directories are no longer searched; `coverage.include`/`exclude` are
  precise relative globs. The default `forks` pool is used everywhere —
  `vmThreads` with `isolate: false` has known 5.0 regressions.
- **No production code without a failing test you watched fail.**
