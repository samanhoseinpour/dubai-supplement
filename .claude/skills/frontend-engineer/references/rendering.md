# Rendering shapes — Cache Components

Ground truth: `.claude/rules/web.md`, foundation spec §7.4–§7.6, ADR-0006,
the `new-web-route` skill. The page prerenders at build with no API; data
streams into `<Suspense>` islands at request time and is cached across users,
keyed by URL. Nothing here reads `cookies()` or `headers()`.

## 1. A list — `/brands` (3c)

```tsx
// app/brands/page.tsx — synchronous, uncached, awaits nothing itself
import { Suspense } from 'react'
import { SkeletonText } from '@/components/ui/skeleton'
import { BrandList } from './brand-list'

export default function Page() {
  return (
    <Suspense fallback={<SkeletonText lines={6} />}>
      <BrandList />
    </Suspense>
  )
}
```

```tsx
// app/brands/brand-list.tsx — the island
import { io } from 'next/cache'
import { EmptyState } from '@/components/ui/empty-state'
import { getBrands } from '@/lib/catalog'
import { copy } from '@/lib/copy'

export async function BrandList() {
  await io() // first, before any uncached work: excludes the island from the shell
  const brands = await getBrands()
  if (brands.length === 0) return <EmptyState title={copy.brands.empty} />
  return <ul>{/* Surface pressable + Link variant="plain" per brand */}</ul>
}
```

```ts
// lib/catalog.ts — cached data functions live in lib/, never in a component file
import 'server-only'
import { ApiError, publicApi } from '@ds/api-client/server' // 3b; exact shape is that package's
import { cacheLife, cacheTag } from 'next/cache'

export async function getBrands() {
  'use cache'
  cacheLife('hours')
  cacheTag('catalog', 'brands')
  const { data } = await publicApi.GET('/catalog/brands')
  return data ?? []
}

export async function getBrand(slug: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('catalog', `brand:${slug}`)
  try {
    const { data } = await publicApi.GET('/catalog/brands/{slug}', { params: { path: { slug } } })
    return data ?? null
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CATALOG_BRAND_NOT_FOUND') return null
    throw error
  }
}
```

## 2. A detail — `/brands/[slug]`

`new-web-route` scaffolds it: the page passes the `params` promise into the
island; the island does `const { slug } = await params`, then `await io()`,
then `getBrand(slug)`, and calls `notFound()` on `null`. Two things it does not
say:

- `notFound()` inside a streamed island renders `not-found.tsx` with
  `noindex` but answers **200** — the shell already streamed. A real 404
  waits for `proxy.ts` (foundation §7.6).
- `generateMetadata` follows the same rule: await `params` inside it, read
  through the same cached function, never through `requestApi()`.

## 3. A second island — product detail, later

The product body and its price/stock are separate islands with separate
cached functions: the body keeps `cacheLife('hours')`; price and stock get a
shorter profile and their own tag (`variant:<id>`) — the slice's spec sets the
numbers. The buy affordance renders only once a variant is known
(`SKILL.md`, "Authority"); a rejected purchase is a rendered state.

## 4. `app/sitemap.ts` (3c)

```ts
import { publicApi } from '@ds/api-client/server'
import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { siteUrl } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection() // request time; never the cached getBrands() — that would run at build
  const { data } = await publicApi.GET('/catalog/brands')
  const base = siteUrl()
  return [
    { url: new URL('/', base).href },
    { url: new URL('/brands', base).href },
    ...(data ?? []).map((brand) => ({ url: new URL(`/brands/${brand.slug}`, base).href })),
  ]
}
```

## 5. A Server Action — shape; lands with the identity spec

```ts
'use server'
import { ApiError, requestApi } from '@ds/api-client/server'
import { SomeInput } from '@ds/contracts'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorMessage } from '@/lib/errors'

export async function submit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SomeInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'invalid', issues: parsed.error.issues }
  const api = await requestApi() // cookies, request id, the real client IP — never publicApi here
  try {
    await api.POST('/…', { body: parsed.data })
  } catch (error) {
    if (error instanceof ApiError) return { status: 'rejected', message: errorMessage(error.code) }
    throw error // an unexpected failure belongs to error.tsx
  }
  updateTag('…') // only when a 'use cache' function serves what changed; a dynamic page needs no tag
  redirect('/…') // outside the try — it throws on purpose
}
```

The form that calls `useActionState` and binds `pending` to `Button loading`
is a client component. `web.md`'s `'use client'` list does not include it
yet: the first form grows that list through its spec, not through a silent
exception.

## 6. A route handler

```ts
// app/health/route.ts — the only one; a new one needs a reason the API cannot serve
import { connection } from 'next/server'

export async function GET() {
  await connection()
  return Response.json({ status: 'ok' })
}
```

## What breaks the shell, and how it shows

| Mistake                                                                        | Effect                                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `await params` or `await searchParams` in the page function                    | the whole route leaves the static shell                     |
| `requestApi()`, `cookies()` or `headers()` inside `'use cache'`                | a request-time error; the build stays green                 |
| `cookies()` in `app/layout.tsx`                                                | every page dynamic                                          |
| `new Date()` or `Math.random()` in a prerendered component                     | a build error; inside `'use cache'` they run once per entry |
| `'use cache'` on a synchronous function                                        | an error — the directive needs an async function            |
| `export const dynamic \| revalidate \| fetchCache \| runtime \| dynamicParams` | lint                                                        |
| the cached `getBrands()` from `sitemap.ts`                                     | runs at build, against no API                               |
| `reset` instead of `retry` in `error.tsx`                                      | re-renders the cached RSC payload and throws again          |
| `redirect()` or `notFound()` inside a `try/catch`                              | swallowed; the user sees the catch branch                   |
