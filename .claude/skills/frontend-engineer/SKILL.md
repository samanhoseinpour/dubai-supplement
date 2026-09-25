---

name: frontend-engineer
description: >
This skill should be used when implementing, reviewing, debugging, refactoring,
or designing frontend work for Dubai Supplement, especially apps/web, React,
Next.js, UI components, forms, frontend data access, accessibility, RTL,
performance, caching, frontend security, and browser testing.
---

---

# Frontend Engineer

Operate as a senior frontend engineer for the Dubai Supplement storefront.

This skill supplements:

- `CLAUDE.md`
- `docs/architecture/north-star.md`
- the relevant feature spec
- the relevant implementation plan

Those sources are authoritative.

Never silently override an architectural invariant.

If a proposed frontend change conflicts with the North Star, it is an
architecture decision requiring the repository's ADR/spec process, not an
ordinary implementation detail.

---

# 1. Before implementing

Before changing frontend production code:

1. Read `CLAUDE.md`.
2. Read the relevant North Star sections.
3. Read the applicable feature spec and plan.
4. Inspect existing implementation and tests.
5. Identify the server/client boundary.
6. Identify the authoritative data owner.
7. Identify applicable loading, empty, failure and mutation states.
8. Write the failing test required by the repository workflow.
9. Observe that test fail for the intended reason.
10. Implement the minimum coherent solution.

Do not invent product requirements because they appear to be standard
e-commerce functionality.

Do not implement functionality listed as deferred in the North Star before its
spec authorizes it.

---

# 2. Decision priorities

Optimize decisions in this order:

1. correctness and data integrity
2. security and privacy
3. accessibility
4. user experience
5. maintainability and clarity
6. performance
7. developer experience

Never sacrifice correctness, authorization, accessibility or data integrity for
a minor performance or abstraction improvement.

Prefer explicit, boring and understandable code over clever code.

---

# 3. Permanent domain invariants

Frontend code must preserve repository domain invariants.

## Sellable unit

Only `ProductVariant` is sellable.

A `Product` groups variants. It is not itself the purchasable unit.

Cart, inventory and checkout interactions must operate on a variant identity.

Bad conceptually:

```tsx
<AddToCart productId={product.id} />
```

Prefer an interaction based on a selected variant:

```tsx
<AddToCart variantId={selectedVariant.id} />
```

If a product has multiple selectable variants, the UI must not imply that the
product can be purchased until the required variant is known.

Never guess or silently choose a variant unless the feature specification
explicitly defines such behavior.

## Money

Money is IRR minor units in the domain.

Never use floating-point arithmetic for prices or totals.

Never make Toman the underlying data model.

Use the repository Persian formatting utilities for display.

The browser must never be authoritative for a monetary total used by cart or
checkout.

## Inventory and price

Catalog information may be cached or become temporarily stale.

Purchase correctness may not.

The API remains authoritative for:

- current variant existence
- current price
- availability
- inventory
- reservation behavior
- promotions
- checkout totals

The frontend must gracefully handle the server reporting that displayed catalog
state is no longer valid.

## Checkout

At launch, checkout ends in the specified WhatsApp handoff.

Do not introduce:

- payment-provider UI
- card forms
- payment SDKs
- payment scripts

unless a later payment specification explicitly enables them.

---

# 4. Server-first Next.js architecture

Next.js Server Components are the default.

Use a Client Component only when browser execution is actually required,
including:

- user event handling
- interactive local state
- Effects
- browser APIs
- client-only third-party libraries

Do not add `"use client"` for convenience.

Push the client boundary as far down the component tree as practical.

Treat `"use client"` as:

- a server/client architecture boundary
- a serialization boundary
- a JavaScript bundle boundary

Everything imported beneath a client entry point contributes to the client
module graph.

Do not make an entire page client-side because one small control is interactive.

---

# 5. Server/client serialization

Values passed from a Server Component to a Client Component must be
React-serializable.

Do not pass:

- arbitrary functions
- class instances
- infrastructure objects
- API clients
- database objects

through the boundary.

Pass the smallest amount of data the interactive component actually needs.

Prefer:

```tsx
<AddToCart variantId={variant.id} />
```

over passing an entire large product response into a client subtree when the
interaction needs only the variant identity.

Do not serialize sensitive server information merely because React technically
supports its type.

---

# 6. Protect server-only modules

Infrastructure that must never enter the browser bundle should be marked or
structured as server-only.

Examples include modules handling:

- server credentials
- private environment variables
- authenticated server-side API access
- request cookies
- server observability
- privileged infrastructure

Use `server-only` where appropriate so an accidental import into a Client
Component fails during development/build.

Similarly, isolate truly browser-only modules when necessary.

---

# 7. API boundary

The frontend architecture is:

```text
apps/web
   ↓
@ds/api-client
   ↓
@ds/contracts
```

`apps/web` must never import from `apps/api`, including types.

Never manually recreate an API contract already owned by `@ds/contracts`.

Never access the API database directly from the Next.js application.

Never introduce Drizzle or another persistence path into `apps/web` to bypass
the API.

The Nest application remains the business-system boundary.

---

# 8. Server Actions and Server Functions

Server Actions may be useful as frontend mutation adapters.

They are not a replacement for the Nest API.

A frontend Server Action may:

- parse form input
- validate frontend-facing shape where useful
- obtain required request/session context
- call `@ds/api-client`
- map expected API failures into UI state
- invalidate appropriate frontend caches
- redirect after success

It must not become a second implementation of:

- catalog business rules
- inventory rules
- cart rules
- promotion rules
- pricing rules
- authorization rules
- checkout rules

Treat every Server Action argument as untrusted.

The API must still enforce authorization and business invariants.

Server Functions are mutation-oriented. Do not use them as a substitute for
ordinary server-side read/data-fetching architecture.

---

# 9. Route Handlers and proxy

Do not create Next.js Route Handlers merely to duplicate Nest API endpoints.

A Route Handler needs a concrete web-specific reason to exist.

Do not turn `apps/web` into a second REST API layer by default.

Likewise, `proxy.ts` must not become the sole authorization boundary.

Authorization must remain enforced by trusted server-side business systems.

---

# 10. Data fetching

Initial route data should normally be fetched on the server.

Prefer the typed API client.

Avoid mounting a Client Component and then immediately fetching data that could
have been retrieved during server rendering.

Avoid unnecessary request waterfalls.

Start independent requests concurrently where their semantics permit it.

Do not introduce a client query/cache library merely because server data exists.

TanStack Query is explicitly deferred until a specification justifies it.

Direct browser-to-API fetching requires an explicit architectural reason,
especially because authentication, cookies, CORS and failure semantics differ
from server-side API access.

---

# 11. Cache Components

The project uses Next.js Cache Components.

Caching is opt-in and intentional.

Before caching data classify it as:

- public reusable data
- frequently changing public data
- personalized data
- request-specific data
- security-sensitive data

Public catalog reads are natural cache candidates.

Authentication, sessions, carts, checkout, OTP state and customer-private data
must not accidentally enter a shared cache.

Do not cache personalized data merely because a cache key could technically be
constructed for it.

That requires an explicit design.

---

# 12. Cache keys and request data

Do not access dynamic request APIs such as cookies or headers from inside an
inappropriate cached scope.

Read required request-specific context outside the shared cache boundary.

Pass only the values genuinely needed by downstream operations.

Never place credentials, tokens or sensitive values into cache keys.

---

# 13. Cache lifetime and tags

A cached data source should have an intentional freshness strategy.

Where appropriate define:

- cache lifetime
- cache tags
- mutation invalidation
- behavior when data changes outside the web process

Do not cache something without understanding how it becomes fresh again.

Use current Next.js Cache Components semantics rather than legacy caching
patterns.

For on-demand invalidation distinguish between:

- stale-while-revalidate behavior
- read-your-writes behavior
- route/path invalidation

Do not substitute one blindly for another.

If data may be changed by another application, admin process or API workflow,
local frontend mutation invalidation alone may not be sufficient.

The feature specification must define the required freshness behavior.

---

# 14. Suspense and streaming

Design asynchronous rendering around user-visible regions.

Decide whether each async region should:

- be part of the static shell
- use cached data
- stream independently
- block the route

Place Suspense boundaries around meaningful UX units.

Do not surround arbitrary tiny implementation details with Suspense simply
because they are async.

Fallbacks should preserve layout stability where practical.

Avoid turning an entire page into one spinner when independent areas can become
useful sooner.

---

# 15. State ownership

Classify state before creating it.

## URL state

Use URL/search parameters for state users should reasonably be able to:

- share
- bookmark
- refresh
- navigate backward/forward through

Examples include:

- search terms
- catalog filters
- category
- brand
- sorting
- pagination

Do not duplicate URL state into React state without a reason.

## Server state

Products, variants, prices, inventory, carts, customers and orders originate
from server systems.

Do not automatically copy server state into a global client store.

## Local interaction state

Keep ephemeral state close to the interaction that owns it.

Examples:

- dialog visibility
- disclosure state
- temporary selection
- transient form interaction state

## Derived state

Do not store something that can be calculated from existing props/state.

Prefer:

```tsx
const fullName = `${firstName} ${lastName}`
```

over an Effect that synchronizes a second state variable.

---

# 16. Effects

`useEffect` is for synchronizing React with an external system.

Examples include:

- browser subscriptions
- timers
- third-party imperative APIs
- DOM APIs not expressible declaratively

Do not use Effects for:

- ordinary derived data
- copying props into state
- handling a click
- sequencing normal application logic
- initial route fetching that belongs on the server
- synchronizing two React state values

If an Effect immediately calls `setState`, first determine whether the state
model is wrong.

Effects involving subscriptions or asynchronous work must implement correct
cleanup behavior.

---

# 17. React Compiler and memoization

The repository pins React Compiler tooling.

If React Compiler is enabled for `apps/web`, rely on it for routine
memoization.

Do not scatter:

- `useMemo`
- `useCallback`
- `memo`

through new code by default.

Use explicit memoization only when:

- semantic referential stability is required, or
- profiling demonstrates a real need, or
- compiler behavior requires an intentional escape hatch

Memoization is not evidence of performance engineering.

---

# 18. Component design

A component should represent a coherent responsibility.

Do not split purely because a file crossed an arbitrary line count.

Extract when doing so creates a meaningful boundary such as:

- reusable interaction behavior
- a coherent UI concept
- an independently testable responsibility
- separately changing concerns

Prefer composition over large configuration-heavy universal components.

Avoid premature generic abstractions.

A small amount of obvious duplication is preferable to the wrong abstraction.

---

# 19. Frontend architecture

Do not mechanically reproduce the backend's DDD directory structure in the UI.

Backend bounded contexts describe business ownership.

Frontend code often needs to compose several contexts around a user journey.

Organize frontend code according to the storefront's actual route, ownership and
change boundaries.

Use domain terminology consistently, but do not force presentation code into
backend-shaped layers when it makes the UI architecture harder to understand.

Shared frontend code must be genuinely shared.

Do not create global dumping grounds such as increasingly unrelated:

```text
components/
hooks/
utils/
helpers/
```

without clear ownership.

Follow repository public-entry-point rules where applicable.

Avoid deep imports across intentional boundaries.

---

# 20. Custom hooks

Create a custom hook when it provides a meaningful reusable client-side
behavior.

Do not create hooks merely to:

- wrap a one-line function
- hide straightforward component logic
- rename an API call
- avoid seeing state in the component

A custom hook should improve the conceptual API of the feature.

---

# 21. TypeScript

Use TypeScript to constrain invalid states.

Do not use `any` to make a type error disappear.

Use `unknown` for genuinely unknown input and narrow it.

Avoid unsafe type assertions.

Prefer generated/shared contract types over handwritten copies.

Use discriminated unions for mutually exclusive states.

For example:

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: UiError }
```

Prefer exhaustive handling where practical.

Do not represent contradictory UI states through unrelated booleans such as:

```ts
isLoading
isSuccess
isError
```

when a single state machine better represents reality.

---

# 22. Forms and mutations

Native form semantics are the baseline.

Forms must consider applicable:

- pending state
- field validation
- server validation
- duplicate submission
- success
- expected business rejection
- unexpected failure
- retry
- keyboard submission

Use React/Next.js form capabilities when they simplify the workflow.

Client validation is for UX.

It is never a trust boundary.

A disabled submit button is not a correctness mechanism.

Operations for which duplicate requests matter must also be safe at the
server/domain layer.

Use optimistic UI only when rollback and reconciliation behavior is clear.

Do not optimistically represent inventory, money or checkout state as final when
the server can legitimately reject it.

---

# 23. Error modeling

Distinguish expected failures from unexpected failures.

Expected examples:

- invalid form data
- unavailable variant
- changed price
- insufficient inventory
- expired session
- invalid promotion
- rejected checkout action

Represent these as intentional UI states.

Do not turn normal business failures into generic exceptions.

Unexpected bugs and infrastructure failures belong in the appropriate Next.js
error boundary.

Use `notFound()` for true route-resource absence where appropriate.

Be careful not to swallow framework control-flow operations such as redirects
or not-found handling inside overly broad exception handling.

Never expose stack traces, internal API details or raw exception messages to
customers.

Customer-visible error copy belongs in Persian.

---

# 24. Loading and empty states

A feature is not finished when only the happy path works.

Consider applicable states:

```text
initial
pending
success
empty
expected failure
unauthorized
forbidden
not found
unexpected failure
retrying
refreshing
stale
```

Do not use generic full-screen spinners by default.

Use skeletons only when they approximate the final structure and improve
perceived continuity.

Avoid skeletons that create more layout shift than the real content.

---

# 25. Navigation

Use links for navigation and buttons for actions.

Do not implement navigation semantics using clickable generic elements.

Prefer declarative Next.js navigation when it satisfies the requirement.

Use imperative navigation only when the interaction genuinely requires it.

Preserve filter/search state in URLs when users reasonably expect Back,
Forward, refresh and sharing to work.

---

# 26. Accessibility

Accessibility is a correctness requirement.

Use native semantic HTML first.

Prefer elements such as:

```html
<button>
  <a>
    <nav>
      <main>
        <section>
          <form>
            <label>
              <fieldset>
                <legend></legend></fieldset
            ></label>
          </form>
        </section>
      </main></nav
  ></a>
</button>
```

over generic elements with recreated behavior.

Do not use a clickable `div` where a button or link is correct.

All critical interactions must be keyboard operable.

Maintain visible focus.

Do not remove focus outlines without an accessible replacement.

---

# 27. Accessible interactive components

Dialogs and drawers must correctly handle:

- accessible naming
- initial focus
- keyboard operation
- Escape behavior when appropriate
- focus containment where required
- focus restoration

Forms require associated labels and accessible errors.

Async UI changes such as cart updates should be communicated appropriately when
a sighted user would otherwise receive information unavailable to a screen
reader user.

Do not add ARIA where native semantics already solve the problem.

Automated axe checks supplement semantic and keyboard review; they do not
replace it.

---

# 28. RTL and Persian layout

The site is permanently:

```html
<html lang="fa" dir="rtl"></html>
```

Do not introduce an i18n framework.

Do not prepare speculative LTR architecture.

RTL must be correct by construction.

Use logical Tailwind utilities:

```text
ms-
me-
ps-
pe-
start-
end-
text-start
```

Physical-direction layout utilities are forbidden by repository rules.

Use `rtl:` only for truly directional visuals such as icons that need
mirroring.

---

# 29. RTL DOM semantics

Do not reverse semantic DOM order merely to make a layout look RTL.

Reading order, keyboard order and DOM order should remain logically meaningful.

Use CSS direction/layout capabilities rather than reversing data arrays or DOM
structure unless the domain itself requires reverse ordering.

Pay special attention to mixed-direction values such as:

- phone numbers
- URLs
- product codes
- English brand names
- email addresses

Use appropriate bidi semantics such as `dir` or `<bdi>` where needed instead of
hard-coded spacing tricks.

---

# 30. Persian utilities

Use `@ds/persian` rather than recreating Persian helpers inside `apps/web`.

Existing shared capabilities include:

- Persian normalization
- ASCII digit conversion
- Persian digit conversion
- Persian number formatting
- Toman display formatting
- Jalali date formatting
- Iranian mobile validation
- national ID validation
- postal code validation
- Sheba validation

Do not duplicate these with ad-hoc regexes or formatter instances.

Jalali date formatting must remain server-side according to the repository
invariant to avoid ICU-related hydration differences.

Use the repository timezone conventions rather than browser-local assumptions.

---

# 31. Responsive design

Design from content constraints rather than named device models.

Every customer-facing flow must remain usable at narrow and wide widths.

Do not make mobile a compressed desktop layout.

Important storefront controls must remain usable with touch input.

Avoid:

- hover-only functionality
- accidental horizontal page overflow
- tiny interactive targets
- fixed dimensions that break with Persian text

Test realistic long Persian product and variant names.

---

# 32. Styling and Tailwind

Use Tailwind CSS according to repository constraints.

Prefer CSS layout capabilities over JavaScript measurement.

Use Grid and Flexbox intentionally.

Avoid unnecessary wrapper elements.

Avoid unexplained magic values.

Repeated values that clearly represent the product's visual system should
eventually become deliberate tokens/primitives rather than unrelated arbitrary
values.

Do not build a design-system package merely because several components share
styles.

`packages/ui` remains deferred until explicitly specified.

---

# 33. shadcn/ui and UI primitives

Installed/generated UI primitives become repository-owned source code.

Treat them as starting points, not untouchable vendor internals.

Preserve accessibility behavior when modifying them.

Do not generate a second primitive when an existing one correctly solves the
same problem.

Do not elevate every visual fragment into the global design system.

Reusable primitives need a deliberate API and proven reuse.

---

# 34. Performance

Optimize architecture before component-level micro-optimizations.

Prioritize:

1. minimizing client JavaScript
2. keeping client boundaries narrow
3. preventing request waterfalls
4. caching appropriate public data
5. streaming slow independent regions
6. avoiding unnecessary hydration
7. serving correctly sized images
8. preventing layout shift
9. lazy-loading expensive optional client functionality
10. profiling before manual render optimization

Do not claim a performance improvement without identifying the work that was
removed or made cheaper.

Measure instead of guessing.

---

# 35. Images and fonts

Use Next.js image capabilities where appropriate.

Product images should reserve their rendered geometry to avoid layout shift.

Serve appropriately sized images.

Do not ship unnecessarily large originals to small screens.

Production must not depend on foreign runtime image, font or script hosts.

Vazirmatn and other required production assets must remain self-hosted.

Do not introduce external CDN dependencies casually.

Media architecture itself remains subject to the media specification.

---

# 36. Third-party scripts

Third-party browser scripts have performance, privacy, reliability and security
cost.

Do not introduce:

- analytics scripts
- chat widgets
- trackers
- externally hosted SDKs
- payment scripts
- advertising scripts

without an explicit product/architecture requirement.

Analytics is currently deferred.

The permanent no-foreign-runtime dependency constraint still applies.

---

# 37. Security

Assume everything originating from the browser is attacker-controlled.

Never treat any of the following as authorization:

- hidden UI
- disabled controls
- client validation
- TypeScript types
- Client Component state
- Server Action existence
- proxy redirects

Authorization belongs on trusted server boundaries.

Do not expose secrets to Client Components.

Only intentionally public values may use `NEXT_PUBLIC_*`.

Never place authentication tokens in `localStorage` unless an explicit future
identity ADR/spec changes the existing architecture.

Follow the identity specification for cookies and sessions.

---

# 38. Unsafe content and redirects

Avoid `dangerouslySetInnerHTML`.

If rich HTML becomes a real requirement, define a sanitization and trust
boundary before rendering it.

Treat redirect destinations derived from user input as untrusted.

Do not create open redirects.

Prefer known internal destinations or explicitly validated redirect targets.

---

# 39. Privacy and logging

Do not log secrets or authentication material.

Avoid logging sensitive customer information unnecessarily, including:

- OTP codes
- session tokens
- authorization headers
- refresh tokens
- full customer identity data

Preserve useful request/error context without leaking private information.

Use existing observability infrastructure when it exists.

Do not add an analytics/telemetry provider opportunistically.

---

# 40. SEO

Do not introduce a broad SEO helper architecture before the SEO specification.

For requirements that already need metadata, derive it from canonical server
data rather than duplicating product information in client constants.

Important public storefront content should not depend on client hydration merely
to become meaningful.

Future structured data, sitemap, canonical and robots architecture should follow
its dedicated specification.

---

# 41. Dependencies

Do not install a package for a problem adequately solved by:

- the web platform
- React
- Next.js
- Tailwind
- existing repository packages

Before adding a frontend dependency determine:

1. the exact problem
2. why existing tools are insufficient
3. client bundle impact
4. maintenance health
5. compatibility with pinned React/Next.js versions
6. security implications
7. foreign-runtime implications
8. removability

Follow repository rules for:

- `catalog:` dependency pins
- exact versions
- minimum release age
- isolated workspace dependencies

Do not add exceptions merely to obtain a newly published package.

---

# 42. Deferred technologies

Do not preemptively introduce architecture explicitly deferred by the North
Star.

Examples currently include areas such as:

- TanStack Query
- `packages/ui`
- analytics
- search architecture
- SEO helpers
- media architecture
- admin application infrastructure
- payments

Use them only after the corresponding specification authorizes them.

---

# 43. Testing

Follow the repository's mandatory:

```text
spec → plan → TDD
```

No production implementation before observing the relevant test fail.

Test observable behavior rather than internal implementation details.

Use unit tests for deterministic logic.

Use component/integration tests when they provide useful confidence for
interactive behavior.

Use Playwright for important user journeys.

Use axe within relevant browser tests.

---

# 44. Frontend test cases

Frontend tests should deliberately consider applicable cases such as:

- selected variant versus product
- unavailable variant
- changed price
- empty catalog state
- long Persian text
- keyboard interaction
- form errors
- duplicate submission
- slow API response
- failed API mutation
- RTL layout behavior
- mixed RTL/LTR content
- server/client boundary behavior
- cache invalidation where relevant

A bug fix should normally receive a regression test that fails before the fix.

Avoid large snapshots that provide little behavioral confidence.

---

# 45. E2E verification

`pnpm check` remains mandatory at the end of every task.

However, do not assume `pnpm check` executes browser E2E tests.

When the change affects a meaningful user journey, also run the relevant E2E
suite.

Examples include:

- catalog browsing
- variant selection
- cart
- authentication
- checkout
- critical navigation
- accessibility-sensitive interactions

A passing unit suite does not prove the browser flow works.

---

# 46. Review the diff as a senior engineer

Before declaring completion, inspect the entire diff.

Check whether:

- a Product was accidentally treated as sellable instead of a ProductVariant
- a business invariant moved into the frontend
- `apps/web` imports anything from `apps/api`
- a generated contract was copied manually
- a Server Action became business logic
- a Route Handler duplicates the API
- a `"use client"` boundary is unnecessarily high
- server-only code can leak into the client graph
- initial data is unnecessarily fetched client-side
- requests form a waterfall
- request-specific data was cached
- cache invalidation matches required consistency
- stale price/inventory is handled
- URL state was incorrectly turned into local state
- derived state was stored
- an Effect is unnecessary
- manual memoization is cargo-culted
- expected errors are being thrown as unexpected exceptions
- RTL relies on physical-direction utilities
- DOM order was reversed for visual RTL
- Persian utilities were duplicated
- accessibility semantics were weakened
- secrets or customer data can leak
- a deferred technology was introduced without a spec
- a new package is genuinely necessary
- the tests prove behavior rather than implementation

---

# 47. Definition of done

Frontend work is complete only when:

- its specification is satisfied
- repository invariants remain intact
- ProductVariant semantics are correct
- server/client boundaries are intentional
- business authority remains in the API
- loading/empty/failure states are handled where relevant
- stale transactional data can be reconciled safely
- Persian/RTL behavior is correct
- accessibility has been reviewed
- responsive behavior has been reviewed
- security and privacy implications have been reviewed
- tests cover meaningful behavior
- relevant E2E coverage has been run where necessary
- unnecessary abstractions were avoided
- unnecessary dependencies were avoided
- generated files were not manually edited
- architecture documentation is updated when appropriate
- `pnpm check` passes

Never declare a frontend task complete while known verification failures remain.

---

# 48. Senior engineering rule

When several approaches are valid, prefer the solution that:

- preserves domain correctness
- keeps authority at the correct system boundary
- makes invalid states difficult to represent
- minimizes unnecessary client JavaScript
- keeps data ownership obvious
- exposes predictable failure behavior
- follows existing repository conventions
- avoids speculative infrastructure
- is understandable to another senior engineer
- can be changed or deleted later at reasonable cost

Do not choose an implementation because it demonstrates more React or Next.js
features.

Use the least sophisticated architecture that fully satisfies the actual
requirements.
