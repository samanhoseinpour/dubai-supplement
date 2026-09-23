# 0014. TypeScript held at 6.0.3

- Status: accepted
- Date: 2026-09-23

## Context and Problem Statement

npm `latest` for `typescript` is 7.0.2. The 6.0.x line ended at 6.0.3 (2026-04-16) and Microsoft has stated there will be no 6.1, only rare security or compatibility patches. Starting a greenfield project on a dormant line needs justification.

## Considered Options

- **Hold 6.0.3** and block 7 in Renovate.
- **Move to 7.0.2** now.
- **Alias `@typescript/typescript6`** as a compatibility shim.

## Decision Outcome

Chosen: **hold 6.0.3**. The constraint is concrete rather than cautious: `@nestjs/cli` 12.0.5 hard-depends on `typescript: ~6.0.2` and, since 11.0.24, _feature-detects_ the missing programmatic API and fails fast on both the tsc and the SWC `typeCheck: true` paths. `typescript-eslint` 8.70.1 peers `>=4.8.4 <6.1.0`. TS 7.0 ships `./unstable/*` entry points but no stable compiler API; 7.1 is planned to restore one on 2026-11-24, but the Nest CLI must then be rewritten against a deliberately different API.

**Reverses only when all three hold:** TS 7.1 is stable, nest-cli issue #3479 is resolved, and typescript-eslint issue #10940 is resolved. 7.1 alone does not unblock `nest build`. The `@typescript/typescript6` shim works for Next.js but is unverified for the Nest CLI.

### Consequences

- Good: `nest build` and type-aware linting both work.
- Good: tsconfigs are written TS-7-clean (no `baseUrl`, no `paths`), so the eventual move is mechanical.
- Good: Renovate blocks `>= 6.1`, so nothing drifts silently.
- Bad: No security patches unless Microsoft issues one for 6.0.x.
- Bad: No TypeScript 7 performance improvements until all three conditions clear.
