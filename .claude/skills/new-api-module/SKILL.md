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

1. Take out what is catalog's alone. Drop the copied
   `application/seed-brands.ts`, its `index.ts` export and any call to it in
   `src/seed.ts`, unless the new context needs a seed. Rename the copied
   `@OnDomainEvent` subscription and its handler (`BrandCreatedLogger` on
   `catalog.brand.created`) — left as they are, they subscribe a second
   handler to catalog's event.
2. Add the context to the table in `docs/architecture/north-star.md`.
3. Add its terms to `docs/glossary.md`.
4. Register the module in `app.module.ts`, then run `pnpm openapi:generate`
   and commit the regenerated `apps/api/openapi.json` and
   `packages/api-client/src/generated/schema.ts`. The freshness test is
   integration-only, so a unit-only run never catches the drift.
5. Run `pnpm lint typecheck boundaries test` — `boundaries` is what catches a
   layering mistake, and it is the reason the anatomy is not negotiable.

The skill copies colocated unit tests but writes **no** migration and **no**
integration test. Write those yourself.
