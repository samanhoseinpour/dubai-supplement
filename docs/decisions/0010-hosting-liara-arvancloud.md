# 0010. Hosting on Liara and ArvanCloud; the API is not publicly exposed

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

Customers and the business are both inside Iran. Shaparak payment gateways accept only Iranian IPs, half-price domestic traffic requires an Iranian data centre with ito.gov.ir registration, and foreign providers cannot reliably take Iranian payment or keep Iran-resident accounts.

## Considered Options

- **Liara PaaS + ArvanCloud DNS/CDN** — both Iranian, Heroku-like workflow, managed Postgres/Redis/object storage.
- **A managed foreign stack** (Vercel + Neon + Stripe) in Frankfurt.
- **A self-managed Iranian VPS** running Coolify or Dokploy.

## Decision Outcome

Chosen: **Liara plus ArvanCloud**. It satisfies Iran Access and half-price traffic, and its workflow is the closest to the Vercel habits this project comes from. The API app (`ds-api`) gets **no** public domain: its default `liara.run` subdomain is disabled by hand immediately after creation, and the storefront reaches it at `http://ds-api:3000` over the private network. Liara builds the images from our Dockerfiles because it does not support private registries. The exit path is real: the same Dockerfiles and `compose.yaml` run unchanged on any Iranian VPS with Coolify or Dokploy.

### Consequences

- Good: Iranian IPs, half-price traffic and a future Shaparak gateway all remain possible.
- Good: The API has no internet-facing address at all.
- Good: Migrating away is a redeploy of the same images, not a rewrite.
- Bad: No horizontal scaling — vertical only.
- Bad: The private network is chosen at resource-creation time and is immutable, so it must be created first.
- Bad: An `INTERNAL_API_TOKEN` header guard is the next hardening step, to add with the first write endpoint.
