# 0006. Next.js Cache Components, and the Next server as the only API caller

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

The storefront must render Persian catalogue pages fast over Iranian networks, and the API must not be exposed to the internet. Next.js 16 offers Cache Components (`use cache`, `cacheLife`, `cacheTag`) and explicit request boundaries (`io()`, `connection()`).

## Considered Options

- **Cache Components from day one**, with the Next server as the only caller of the API over Liara's private network.
- **Browser calls the API directly**, with CORS and public exposure.
- **Route segment config** (`dynamic`, `revalidate`) as in older Next versions.

## Decision Outcome

Chosen: **Cache Components, Next server as the only caller**. One origin means no CORS, simple cookies and an API that never needs a public address. Pages render a static shell immediately and stream cached data into a `<Suspense>` island, so a slow API never blocks first paint. Route segment configs are banned by lint because they and Cache Components express the same intent two incompatible ways.

### Consequences

- Good: The API needs no public hostname; its default Liara subdomain is disabled.
- Good: Cached catalogue data is shared across users and keyed by URL only.
- Good: A build never calls the API — proven by building with an unreachable `API_INTERNAL_URL`.
- Bad: `publicApi` must never touch `headers()` or `cookies()`; that fails at request time, not at build.
- Bad: A direct browser-to-API path later needs the `requestApi()` half, which the identity spec adds.
