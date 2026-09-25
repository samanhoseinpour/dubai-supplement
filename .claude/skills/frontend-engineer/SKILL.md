---
name: frontend-engineer
description: Build, change or review storefront code in apps/web. Use for any task that touches apps/web — a route in the Cache Components shape, a Base UI primitive and its /design entry, token-only Tailwind, RTL and Persian rendering, forms and error states, the unit, e2e, budget and axe gates — and to self-review a web diff before hand-over. It adds the shapes and checklists the rules files leave to judgement; it never restates them.
paths:
  - 'apps/web/**'
---

# Frontend engineer

The ground truth loads with every web task and this skill never repeats it:
`CLAUDE.md`, `docs/architecture/north-star.md`, `apps/web/CLAUDE.md`,
`.claude/rules/web.md`, `persian.md`, `security.md`, `testing.md`. The design
system is `docs/superpowers/specs/2026-09-25-storefront-design-system-design.md`
(§5 tokens · §6 type · §7 motion · §8 components · §9 the UX laws as rules ·
§10 verification · §11 lint); feel is the `apple-design` skill; a route's
skeleton is `new-web-route`. Where this skill and any of those disagree, they
win — fix the skill.

## Before writing code

1. Read the spec section and the plan task the change implements. What the
   spec does not ask for is a question for Saman, not a default: "standard
   e-commerce" is not a requirement, and north-star §4 lists what is deferred.
2. Look at `/design` (`app/design/sections/`). The primitive and state you need
   either exists or is the first thing you build — see "Primitives".
3. Decide the boundary: a server component unless `web.md`'s `'use client'`
   list says otherwise.
4. Write the failing test (`references/testing.md` has the house shapes) and
   watch it fail for the intended reason.
5. End with `pnpm check`; add `pnpm e2e` when a view changed — `pnpm check`
   never opens a browser.

## Rendering

- The page is synchronous and uncached. A `<Suspense>` island awaits
  `params`/`searchParams`, then `await io()`, then a `'use cache'` function
  in `lib/` (`cacheLife`, `cacheTag`) that calls the API through `publicApi`.
  `references/rendering.md` has the list, detail, second-island, sitemap,
  Server Action and route-handler shapes with code.
- `publicApi` (`@ds/api-client/server`, `server-only`, lands with 3b) in
  every cached scope; `requestApi()` only in a dynamic one — cart, account,
  actions — and it lands with the identity spec. `'use cache'` rejects
  `cookies()`/`headers()` at request time, not at build, so a green
  `pnpm build --filter=web` against `API_INTERNAL_URL=http://127.0.0.1:9`
  proves only that the shell calls nothing.
- A Server Action is a thin adapter: parse with a `@ds/contracts` schema,
  `requestApi()`, map `ApiError.code` through `lib/errors.ts`, `updateTag`
  for read-your-writes (`revalidateTag` when stale-while-revalidate is
  enough), `redirect`. Rules, authorization and totals stay in the API; every
  argument is untrusted. Never wrap `redirect()` or `notFound()` in a
  `try/catch` — they throw on purpose.
- `connection()` belongs in a route handler or `app/sitemap.ts` only. A
  `new Date()` in a prerendered component is a build error; put it in a
  `'use cache'` function, as `CopyrightYear` in `app/layout.tsx` does.
- Mounted-or-not is `useSyncExternalStore`, not an effect with a setter.
  `useMemo`/`useCallback`/`memo` are
  the compiler's job (`reactCompiler: true`); `'use no memo'` on a file is
  the one escape hatch, for a Base UI render prop the compiler mishandles.
- `app/health/route.ts` is the only route handler; a new one needs a reason
  the API cannot serve. The browser never calls the API — it has no public
  address — and `proxy.ts`, when it arrives, is never the authorization
  boundary.

## Authority — the storefront half of the invariants

- Only a `ProductVariant` is priced or added to a cart. A product with more
  than one variant shows no buy affordance until one is chosen; never pick
  one silently.
- Money crosses the boundary as `amountMinor: bigint` and `Price` renders it.
  The browser never computes a total that matters and never treats a cached
  price or stock as final: the API may reject it, and that rejection is a
  rendered state with a Persian sentence, not an error boundary.
- Checkout ends in the WhatsApp handoff (ADR-0011): no payment UI, SDK or
  script until a payments spec says so.

## Styling

- What exists: the semantic colour utilities (`bg-primary`,
  `text-muted-foreground`, `border-input`, `bg-destructive-soft`, …), the type
  scale `text-caption … text-display`, `rounded-sm|md|lg|full`,
  `shadow-sm|md|material`, `font-normal … font-extrabold`, `ease-out|in`,
  `duration-(--duration-press|quick|fade)`, `animate-shimmer|spin`,
  `z-header|overlay|sheet|toast`, the utilities `container-page`, `prose`,
  `material`, `press`, `focus-ring`, `popup`, `skeleton`, and Tailwind's
  default spacing and breakpoints. Everything else is unknown or restricted;
  `test/lint.test.ts` is the exact contract.
- A new value is a token first, never "arbitrary now, token later":
  `app/globals.css`, then the pair in `test/tokens.test.ts` (a colour), the
  scales in `lib/utils.ts` (`cn` must learn a new scale or `twMerge` drops
  the class), then `/design`.
- A component knows semantic names only — never a hex, never a brand
  colour's name.
- Block-axis and dimension utilities (`mt-`, `py-`, `top-`, `w-`, `h-`,
  `size-`, `border-t`) pass; the inline axis is logical.
- Motion is the utilities: `press` on anything pressable, `popup` on a Base
  UI popup, `skeleton` on a fallback. Nothing animates in on load or scroll;
  gesture-driven motion never uses a CSS transition (spec §7.1). Springs are
  `SPRING` in `lib/motion.ts`; `motion` stays uninstalled until the first
  gesture surface.

## Primitives and the gallery

- Inventory (spec §8.1): Button, Link, Surface, Badge, Skeleton and
  SkeletonText, Price, EmptyState, TextField in `components/ui`; Header,
  Footer, Wordmark, Providers in `components/site`. Not built:
  Dialog, Sheet, Select, Checkbox, Radio, Switch, Tabs, Toast, Tooltip, Table,
  Pagination, Carousel, a quantity stepper — each arrives with its first
  slice, through `shadcn add`.
- A new look is a variant of a primitive or a new primitive, and its first
  commit includes its gallery entry: `app/design/sections/<name>.tsx`,
  registered in `SECTIONS` in `app/design/page.tsx`, a title under
  `copy.design.sections`, every variant × size × state rendered as props so
  nothing needs a click. A route composes primitives; it never styles raw
  elements into a look of its own.
- Base UI, not Radix: import per component (`@base-ui/react/menu`), compose
  with the `render` prop (no `asChild`, no `forwardRef`), style state through
  data attributes (`data-highlighted`, `data-invalid`, `data-disabled`,
  `data-starting-style`), `'use client'` on the wrapper. Portals render into
  `<body>` and inherit `dir="rtl"` from `<html>`; `DirectionProvider` is
  already in `Providers`. `references/primitives.md` has the wrapper shapes
  and the `shadcn add` remap procedure.
- Every interactive element carries `data-target=""` and measures ≥ 44 × 44.
  Button's smallest size is 44 and its default variant is `secondary` —
  primary is a per-view choice.

## RTL and Persian

- Direction is decided once, in `lib/icons.ts`: `IconForward` is the left
  chevron. No `rtl:` on layout, no reversed arrays, no reversed DOM.
- A Latin run inside Persian — a URL, an e-mail, a SKU, a brand name — is
  isolated with `<bdi>` or `dir="ltr"` on its own span, never with spacing.
  Phone numbers and prices are Persian digits and need nothing.
- Digits and dates are formatted on the server; a component that formats
  imports `'server-only'` as `Price` does (the Vitest alias stubs it).
  `tabular-nums` on every numeric column.
- Copy is a key in `lib/copy.ts` in the spec's voice (§6.5): formal شما, a
  call to action that names what happens, an error that says what went wrong
  and what to do next, no apology. Error sentences come from `lib/errors.ts`
  (`errorMessage`, `describeError`). ZWNJ is part of a word; display never
  strips or replaces it.
- Everything is start-aligned; `EmptyState` and the hero are the only centred
  things. Try long Persian product and variant names; no fixed width may
  break under them.

## Forms, loading, errors

- `TextField` (Base UI Field) already wires label, hint and error; pass
  `inputMode` for numeric entry and accept ASCII, Arabic-Indic and Persian
  digits — `@ds/persian` normalises on write, display stays strict.
- `Button loading` keeps the label and the width, sets `aria-busy` and
  swallows a second submit; a disabled submit is not a correctness mechanism,
  and the API is idempotent wherever a double request matters.
- An expected failure — changed price, unavailable variant, invalid code,
  expired session — is a rendered state with its Persian sentence. An
  unexpected one reaches `error.tsx`, which calls `retry`. `notFound()`
  inside a streamed island answers 200 with `noindex`; a real 404 waits for
  `proxy.ts`.
- A fallback is `SkeletonText` shaped like the content; an empty result is
  `EmptyState` with one action. No page-level spinner exists, and none is
  added.

## Tests and gates

- Unit: Vitest 5, jsdom, Testing Library, `css: false` — assert classes and
  roles (`toHaveClass`, `getByRole` with the Persian name), never computed
  styles. A server component renders as a plain function. Digits:
  `expect(html).not.toMatch(/[0-9]/)`.
- A new lint rule or restricted class gets its fixture in
  `test/lint.test.ts`; a new colour token gets its pair in
  `test/tokens.test.ts`; a new copy key passes `lib/copy.test.ts` only if it
  is Persian.
- e2e (`pnpm e2e`, the production build): axe at WCAG 2.2 AA, every
  `[data-target]` ≥ 44 × 44, inputs ≥ 16 px, `letter-spacing: normal`,
  reduced motion honoured. A new route gets its own spec in `e2e/`.
- Budget runs inside `pnpm check` and builds web: ≤ 100 KB gzipped of a
  route's own JavaScript beyond Next's root files, root files ≤ 140 KB, the
  font ≤ 120 KB. A client-side dependency is a budget question before it is
  a catalog entry.

## Environment and dependencies

- `getServerEnv()` is called at request time, never read at module scope; a
  variable a task reads is declared in `turbo.json` (`envMode: strict`);
  `NEXT_PUBLIC_SITE_URL` is baked in at build. Never open `.env`.
- Nothing is fetched from a foreign host at request time, and there is no
  image pipeline until the media spec — no `images` config, no remote
  patterns, no `next/image` ahead of it.
- `pnpm dlx shadcn@4.21.0 add <name>` is an ask command; what it installs
  is a `catalog:` entry before it runs.

## Before handing over

Read the diff against `.claude/agents/reviewer.md` §4, §6 and §7, then:

- [ ] one primary action in the view; ≤ 7 items in any nav or menu; one
      attention colour per view (spec §9, Von Restorff)
- [ ] spacing tiers — 2–4 inside a component, 6–8 between groups, 12–16
      between sections; a divider only where spacing cannot group
- [ ] the primary CTA is `block` on mobile and last in its group
- [ ] every new primitive and state on `/design`; every string in
      `lib/copy.ts`; every icon from `lib/icons.ts`
- [ ] no `'use client'` outside the allowed list; no `cookies()`/`headers()`
      near a cached scope; no import from `apps/api`
- [ ] the failing test was seen first; `pnpm check` green; `pnpm e2e` green
      when a view changed
- [ ] a conventional commit with scope `web`, authored by Saman alone — no
      co-author trailer, no generated-with footer

## References — load when the task needs them

- `references/rendering.md` — the route shapes with code: list, detail,
  second island, sitemap, Server Action, route handler, and what breaks each.
- `references/primitives.md` — the inventory with props, Base UI wrapper
  shapes, portals under RTL, the `shadcn add` remap, adding a gallery section.
- `references/testing.md` — unit, lint-fixture, token and e2e shapes as this
  repository writes them.
