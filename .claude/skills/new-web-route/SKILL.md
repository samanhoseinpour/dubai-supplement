---
name: new-web-route
description: Scaffold a storefront route in the Cache Components shape.
disable-model-invocation: true
---

# New web route

> **Phase 3 onward.** Needs `apps/web` to exist.

Every catalogue-style route has the same shape (spec §7.5). The page is
**uncached** and never awaits `params` or `searchParams` outside a boundary:

```tsx
export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Detail params={params} />
    </Suspense>
  )
}

async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await io() // excludes this island from the static shell
  const data = await getThing(slug) // 'use cache' + cacheLife + cacheTag
  if (!data) notFound()
  return <View data={data} />
}
```

Rules that are easy to get wrong:

- `await io()` comes **before** any uncached work inside the island.
- The `'use cache'` data function goes in `lib/`, not in the component file,
  and reaches the API through `publicApi` — never `requestApi()`, which would
  fail at request time inside a cached scope.
- No route segment config. No physical Tailwind classes. Persian copy only.
- Add the route to `app/sitemap.ts` if it should be indexed.
