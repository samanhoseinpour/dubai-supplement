---
paths:
  - '**/src/generated/**'
  - '**/openapi.json'
---

# Generated files

**Never edit these by hand.** They are build output committed for
reproducibility and CI fails on any drift.

Regenerate with:

```sh
pnpm openapi:generate
```

That boots the API without listening, writes `apps/api/openapi.json`, and
regenerates `packages/api-client/src/generated/schema.d.ts` from it. The CI
`openapi` job runs the same command and fails if `git diff` is non-empty.
