---
name: verify
description: Run the full verification command and summarize what failed.
---

# Verify

Run:

```sh
pnpm check
```

That is lint, typecheck, unit tests, integration tests, module boundaries,
cross-workspace version drift (`sherif`) and the docs check — the single gate
every task must end green.

Report the **first** failing task and its actual output. Do not summarize a
failure as "some tests failed"; paste the assertion. If everything passes,
say so in one line.

`test:integration` needs Docker running (`pnpm db:up` is not required — it
uses Testcontainers). From an Iranian connection that also needs a VPN; see
`docs/runbooks/iran-mirrors.md`.
