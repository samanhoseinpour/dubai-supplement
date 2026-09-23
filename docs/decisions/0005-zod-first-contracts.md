# 0005. Zod-first contracts to OpenAPI to a typed client

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

The storefront and the API must agree on HTTP shapes. A future admin app, a mobile app or a partner may need the same agreement. The shapes must be validated at runtime at the API boundary and known at compile time in the storefront.

## Considered Options

- **Zod schemas as the source of truth** — exported from `@ds/contracts`, converted to OpenAPI, and from there to a typed `openapi-fetch` client.
- **tRPC** — end-to-end types with no schema artifact.
- **ts-rest / oRPC** — a contract object shared by both sides.

## Decision Outcome

Chosen: **Zod first, OpenAPI as the artifact**. The Zod schemas are the portable asset: they validate at the boundary, they generate the client, and the OpenAPI document keeps the API consumable by something that is not this monorepo. tRPC would tie every consumer to a TypeScript client and produce no document.

### Consequences

- Good: One definition validates requests, types the client and documents the API.
- Good: CI fails if `openapi.json` or the generated client drift from the schemas.
- Good: A future non-TypeScript consumer has a real specification to read.
- Bad: Two generation steps (`api#openapi`, `@ds/api-client#generate`) that must stay ordered.
- Bad: Contracts describe HTTP shapes, never domain entities — a discipline the rules file has to enforce.
