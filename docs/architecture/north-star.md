# North Star

The constitution. This is the only document loaded on every task, so it holds
what must never be re-derived: the contexts, the directions dependencies may
point, the invariants, and what this project has decided not to be.

> Background: "Dubai Supplement — Foundation Research", 2026-08-27, and
> "Liara deployment verification", 2026-08-27. Both are held privately,
> outside this repository.
>
> Design: [../superpowers/specs/2026-08-27-foundation-design.md](../superpowers/specs/2026-08-27-foundation-design.md)

## 1. Bounded contexts

| Context       | Responsibility                                                                           | Built                   |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| health        | liveness and readiness                                                                   | yes                     |
| catalog       | Brand, Product, ProductVariant (the only sellable unit), categories, facets              | Brand only              |
| inventory     | stock on hand and reserved, reservations with expiry, movement ledger                    | no                      |
| cart          | guest and customer carts, merge on login                                                 | no                      |
| checkout      | the **only** module allowed to orchestrate across contexts; ends in the WhatsApp handoff | no                      |
| orders        | immutable price and name snapshots, status history, state machine                        | no                      |
| shipping      | methods, carrier port with a manual carrier first                                        | no                      |
| customers     | profiles, addresses (Iranian address model)                                              | no                      |
| identity      | users keyed by phone, OTP challenges, sessions, roles                                    | no — designed, §5 below |
| promotions    | discount codes and campaigns                                                             | no                      |
| reviews       | product reviews                                                                          | no                      |
| wishlist      | saved products                                                                           | no                      |
| notifications | SMS and email dispatch                                                                   | no                      |
| audit         | who changed what                                                                         | no                      |
| media         | uploads, image variants, delivery                                                        | no                      |
| payments      | gateway port, attempts, idempotency — a **planned seam, not wired**                      | no                      |

## 2. Dependency directions

Enforced by `dependency-cruiser` in `apps/api`, `eslint-plugin-boundaries` in
both apps, pnpm's isolated `node_modules`, and `sherif` for version drift.
All of it runs inside `pnpm check`.

1. `apps/*` may depend on `packages/*`. Packages never depend on apps.
2. The only allowed package-to-package edges are
   `@ds/api-client → @ds/contracts` (types only) and
   `@ds/contracts → @ds/persian` (runtime). `@ds/persian` has no workspace
   dependencies and owns the only `@persian-tools` dependency.
3. `apps/web` never imports from `apps/api`, not even types. It uses
   `@ds/contracts` and `@ds/api-client` only.
4. `modules/A/**` may import `modules/B/index.ts` and nothing deeper.
5. `domain/**` is pure TypeScript: no `@nestjs/*`, no `drizzle-orm`, no `pg`,
   no `ioredis`, no sibling layers.
6. `application/**` may not import `infrastructure/**`. Only the module's
   `*.module.ts` wires ports to adapters.
7. `shared/**` and `src/infra/**` never import `modules/**`. No exceptions —
   schema ownership is arranged so none is needed.
8. No cycles anywhere.

## 3. Invariants

These hold everywhere, forever. A change here is an ADR, not a commit.

- **Only variants are sellable.** A product is a grouping; a `ProductVariant`
  is what has a price, a stock level and a row in an order.
- **Checkout orchestrates; everything else reacts.** No other module may
  coordinate across contexts. Other modules learn what happened from domain
  events, never by reaching into another module's tables.
- **Money is IRR minor units** — `amountMinor bigint` plus `currency char(3)`.
  Never Toman in storage. Never a float. Toman is a display concern.
- **Cross-context data access goes through public services or events.** A
  module's tables are private to it. A cross-module foreign key may be
  declared (for integrity) by importing the other module's `tables`
  namespace, but never queried across.
- **Timestamps are `timestamptz` in UTC.** Jalali is a display concern, and
  formatting happens on the server so ICU never causes a hydration mismatch.
- **Persian text is normalized on write**, in the domain entity.

## 4. Non-goals

Permanent, from the foundation decisions:

- **Not a marketplace.** One store, own inventory, one seller. Inventory is
  its own module so multi-warehouse can come later, but sellers will not.
- **Not multilingual.** Persian only, permanently. No i18n library, no
  translatable catalog columns, `<html lang="fa" dir="rtl">` hard-coded.
- **No online payment at launch.** Checkout ends in a WhatsApp handoff.
  Payments stays a clean seam with nothing wired to it.
- **Nothing foreign in the production path.** Customers and the business are
  both inside Iran. Vercel, Neon, Stripe and a Cloudflare proxy are not part
  of production, and nothing is fetched from a foreign host at request time —
  fonts, scripts and images are self-hosted.

Deferred, each awaiting its own spec: products beyond Brand, inventory, cart,
checkout, identity, the admin app, media, SEO helpers, search, promotions,
notifications, payments, analytics, a staging environment, BullMQ,
TanStack Query, `packages/ui`.

## 5. Designed but not built — identity

Recorded here because the identity spec will implement it and nothing else
records it:

- Phone-number OTP login, E.164, throttled per phone **and** per IP — which
  is why the API must see the real client IP.
- Codes are hashed, single-use, with a TTL.
- A short-lived JWT access token in an `httpOnly; Secure; SameSite=Lax`
  cookie, plus an opaque rotating refresh token stored hashed in Postgres.
- A `Role` enum and a `RolesGuard`. Admin accounts require password **and** OTP.
- Cookies carry **no `Domain` attribute**, so a later direct browser-to-API
  path is additive rather than breaking.
