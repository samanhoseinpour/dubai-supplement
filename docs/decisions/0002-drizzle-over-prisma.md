# 0002. Drizzle ORM over Prisma / MikroORM

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

The API needs a typed data layer on PostgreSQL. It must work under pure ESM with NestJS 12, produce reviewable SQL migrations, and not require a separate schema language or a code-generation step in the build.

## Considered Options

- **Drizzle ORM** — TypeScript schema files, SQL-first, migrations generated as plain `.sql`.
- **Prisma** — its own schema language, a generated client, and a query engine binary.
- **MikroORM** — a full Data Mapper with a unit of work and identity map.

## Decision Outcome

Chosen: **Drizzle**, because Saman already knows it, its migrations are reviewable SQL committed to the repository, and it adds no binary or generation step to the container build. Prisma's schema language would be a second source of truth beside the Zod contracts, and its engine binary complicates an Alpine image built on Iranian infrastructure. MikroORM's unit of work hides exactly the transaction boundaries this project wants visible (see ADR-0009).

### Consequences

- Good: Migrations are SQL that a human reviews in the pull request.
- Good: No generation step in `nest build` and no engine binary in the image.
- Good: Transaction boundaries stay explicit — `db.transaction()` passed to repositories.
- Bad: No identity map, so repositories must not assume object identity across a transaction.
- Bad: The relational query API (`db.query.*`) is deliberately unused, so each repository imports only its own module's tables.
