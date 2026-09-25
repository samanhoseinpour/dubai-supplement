# packages/contracts — the HTTP shapes

Zod 4 schemas for what crosses HTTP: queries, params, bodies, response
envelopes, the problem contract. Never a domain entity
(`.claude/rules/contracts.md`). Consumed by `apps/api` (validation, OpenAPI),
`@ds/api-client` (types only) and `apps/web` (types and parsing).

## Layout

- `src/common/` — `id` (`z.uuid()`), `slug`, `persianText(max)` (normalises
  through `@ds/persian`, then `.min(1).max(max)` in code points),
  `PageQuerySchema`, `paginated(item)`.
- `src/errors/` — `ERROR_CODES`, `ErrorCode`, `ProblemDetailsSchema` (RFC 9457).
- `src/catalog/brand.ts` — `BrandSchema`, `BrandListQuerySchema`,
  `BrandListResponseSchema` and their types: the template for every context.
- `src/index.ts` re-exports everything; a new file is added there.

## Rules that bite

- Top-level forms: `z.uuid()`, `z.iso.datetime()`, `z.email()`.
- `z.iso.datetime()` requires seconds: emit `Date#toISOString()`, and pin it
  in the schema's test.
- `.min()`/`.max()` count code points — a ZWNJ costs one.
- A new `ErrorCode` needs its title in `apps/api`'s `TITLE_BY_CODE`, its
  Persian sentence in `apps/web/lib/errors.ts`, and `errors.test.ts` updated.
- `.meta({ id: 'Name' })` on a response schema names it in the OpenAPI
  document and the generated client.
- Every schema has a colocated `*.test.ts`: the accepted shape, each
  rejection, and normalisation through `persianText`.

## Commands

`pnpm test --filter=@ds/contracts` · `pnpm build --filter=@ds/contracts`
(consumers import `dist/`; turbo builds it for `pnpm check`) ·
`pnpm openapi:generate` after changing a schema a route uses.
