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
