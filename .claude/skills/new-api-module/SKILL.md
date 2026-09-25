---
name: new-api-module
description: Scaffold a new bounded context in apps/api using the catalog module anatomy.
disable-model-invocation: true
---

# New API module

> The `catalog` module (Phase 3b, 2026-09) is the template this skill copies:
> `apps/api/src/modules/catalog/`. Its `index.ts`, `catalog.module.ts`,
> `api/`, `application/`, `domain/` and `infrastructure/` are the anatomy.

Copy `apps/api/src/modules/catalog/` to `apps/api/src/modules/<context>/` and
replace the names. Keep the anatomy exactly (spec §5.3):

```
modules/<context>/
├── index.ts               the ONLY path other modules may import
├── <context>.module.ts    ports wired to adapters
├── api/                   controllers; shapes from @ds/contracts
├── application/           use cases, ports, transaction boundaries
├── domain/                entities, value objects, events, errors — pure TS
└── infrastructure/        Drizzle schema.ts and repositories
```

Then:

1. Add the context to the table in `docs/architecture/north-star.md`.
2. Add its terms to `docs/glossary.md`.
3. Register the module in `app.module.ts`.
4. Run `pnpm lint typecheck boundaries test` — `boundaries` is what catches a
   layering mistake, and it is the reason the anatomy is not negotiable.

The skill copies colocated unit tests but writes **no** migration and **no**
integration test. Write those yourself.
