---
paths:
  - '**/infrastructure/schema.ts'
  - 'apps/api/drizzle/**'
  - 'apps/api/src/infra/**/schema.ts'
---

# Database rules

- **Schema keys are camelCase**; `casing: 'snake_case'` derives the real
  column and table names. Table names are plural.
- **`drizzle-kit generate`, then commit the SQL.** Never `drizzle-kit push`.
  Migrations are reviewed in the pull request like any other code.
- **Primary keys** are `uuid` holding a UUIDv7 generated in application code
  — PostgreSQL 16 has no native `uuidv7()`. Ledgers and the outbox use
  `bigint generated always as identity`.
- **Timestamps** are `timestamptz` in UTC. `updatedAt` is set by application
  code. Jalali is a display concern.
- **Money** is `amountMinor bigint` plus `currency char(3)`. Never Toman,
  never a float.
- **Persian text is normalized on write in the domain entity.**
- **Invariants are constraints**, not just code: `CHECK`, `UNIQUE`, partial
  unique indexes.
- **Each module owns its tables.** A cross-module foreign key may be declared
  by importing the other module's `tables` namespace from its `index.ts` —
  for the constraint only. Cross-module `relations()` and query-level joins
  are not allowed.
