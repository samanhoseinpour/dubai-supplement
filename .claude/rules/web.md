---
paths:
  - 'apps/web/**'
---

# Storefront rules

- **No route segment configs.** `export const dynamic`, `revalidate` and
  `fetchCache` are forbidden — they and Cache Components express the same
  intent in two incompatible ways (ADR-0006).
- **`cacheLife`, `cacheTag` and `io` come from `next/cache`.** Call `await
io()` before any uncached work inside a page island. `connection` comes
  from `next/server` and belongs only in route handlers and `sitemap.ts`.
- **Await `params` and `searchParams` inside a `<Suspense>` boundary**, never
  in the page function itself — that would opt the whole page out of the
  static shell.
- **`publicApi` versus `requestApi()`.** `publicApi` has no request context
  and must never touch `headers()` or `cookies()` anywhere in its call chain,
  including middleware; it is what `'use cache'` scopes use. `requestApi()`
  reads request state and belongs only in dynamic scopes.
- **`next/font/local` only.** `next/font/google` is banned by lint: nothing
  is fetched from a foreign host at request time. Vazirmatn is vendored.
- **Logical Tailwind utilities only.** Physical direction classes fail lint.
- **Lint with `eslint .`**, never `next lint`.

## Design system (spec `docs/superpowers/specs/2026-09-25-storefront-design-system-design.md`)

- **Tokens only.** No literal colour, size, radius, shadow or duration in a
  component. `app/globals.css` is the source of truth; Tailwind's palette and
  its default type, radius, shadow, easing and weight scales are deleted, so
  `bg-blue-500`, `text-xl`, `shadow-lg` are unknown classes and fail lint.
  An arbitrary colour (`bg-[#…]`), a variable colour (`bg-(--x)`), a literal
  length (`w-[13px]`) and a literal duration (`duration-300`) fail lint.
- **The inline axis must be logical.** `enforce-logical-properties` is scoped
  to the inline axis: `ml- mr- pl- pr- left- right- border-l|r- rounded-l|r-`
  and the physical corners fail; block-axis and dimension utilities
  (`mt- pt- py- top- bottom- border-t|b- w- h- size-`) are allowed, because
  they never mirror between LTR and RTL.
- **Two colours, light by default.** Black Iris and Frozen; dark inverts the
  ink, never the primary fill. Frozen is a surface, never an ink on a light
  page. `test/tokens.test.ts` guards every pair; change a token, run it.
- **The type scale only.** `text-caption … text-display`, each carrying its
  own leading. `tracking-*`, `leading-none`, `leading-tight` and
  `text-left|right|justify` fail lint. Inputs are never under 16 px.
- **Digits are formatted on the server by `@ds/persian`.** `Price` is the
  only way a price reaches the page. An ASCII digit in customer-facing copy
  is a test failure; `font-feature-settings: 'ss01'` on `html` is a safety
  net, not the policy.
- **Copy lives in `lib/copy.ts`**, icons in `lib/icons.ts` under semantic
  names (`lucide-react` is importable nowhere else; forward is left), error
  sentences in `lib/errors.ts`.
- **Motion is CSS from tokens.** `--duration-press|quick|fade`,
  `--ease-out|in`; press feedback on pointer-down; hover only on hover
  devices; focus rings instant. No entrance choreography, ever. Reduced
  motion, reduced transparency and `prefers-contrast: more` are honoured in
  `globals.css`, not per component — the one JavaScript check is the theme
  toggle's `prefersReducedMotion()`, because a media query cannot gate
  `startViewTransition`. Springs come from `lib/motion.ts`;
  `motion` is installed by the first gesture surface, loaded through
  `LazyMotion` with `domAnimation` and `m`. When that surface arrives:
  momentum projection is `((v / 1000) * rate) / (1 - rate)` with
  `rate = 0.998`, and rubber-banding is
  `(d * dimension * 0.55) / (dimension + 0.55 * |d|)` (apple-design §6, §9).
- **Targets ≥ 44 × 44 px, marked `data-target`.** Exactly one primary action
  per view; ≤ 7 items in a nav or menu; one accent per view — the primary
  button or the inverted badge, never both competing.
- **A primitive or state not on `/design` does not exist.** Adding one means
  adding it to the gallery in every state, in both panels.
- **Static shell.** No `cookies()` or `headers()` in a layout; the theme is
  `next-themes`' pre-paint script. `'use client'` only in Base UI wrappers,
  the theme provider and toggle, and Next's own error boundaries.
- **Error boundaries call Next's `retry`, never `reset`** — only `retry`
  recovers from a Server Component error.
- **Browser floor: Tailwind 4.3** — Safari 16.4+, Chrome 111+. Do not lower
  it with a polyfill or a fallback stylesheet.
