# 0004. PostgreSQL 16 and Redis 7.2

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

The production database and cache are managed services on Liara, whose supported versions are the real ceiling. Liara's DBaaS offers PostgreSQL up to 16.3 and Redis up to 7.2, and does not offer Valkey.

## Considered Options

- **Match production everywhere** — PostgreSQL 16 and Redis 7.2 locally, in CI and on Liara.
- **Newer locally, older in production** — develop on PostgreSQL 18 and Valkey, deploy to 16 and Redis.
- **A different host** with newer versions.

## Decision Outcome

Chosen: **match production everywhere**. A version difference between local and production is a class of bug that only appears after deploy, which is the worst place to find it. PostgreSQL 16 has no native `uuidv7()`, so UUIDv7 is generated in application code with the `uuid` package — a deliberate consequence, not an oversight.

### Consequences

- Good: Local, CI and production run identical engine versions.
- Good: Testcontainers pins the same images CI and compose use.
- Bad: No `uuidv7()`, no PostgreSQL 17/18 features, no Valkey.
- Bad: The ICU `fa` collation must be verified on Liara before the first migration; §6.2 records the fallback.
