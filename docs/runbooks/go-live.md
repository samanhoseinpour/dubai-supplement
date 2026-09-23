# Go-live

Phase 4. **The order is not negotiable**: a Liara resource's private network
is chosen at creation time and is immutable, so the network exists before
anything that must join it.

Every step here is Saman's to perform. Nothing in CI does any of it.

## 1. Private network

Create the Liara private network **first**, before any database, bucket or
app. A resource created outside it cannot be moved into it later.

## 2. Databases

On that network:

- PostgreSQL **16** (Liara's ceiling is 16.3) — plan Mars.
- Redis **7.2** — plan Earth. Liara does not offer Valkey.

## 3. Object storage

Create the bucket. Endpoint `https://storage.iran.liara.site`, region
`default`, path-style addressing.

## 4. Apps

Create `ds-api` and `ds-web` on the same private network.

**Immediately after `ds-api` exists, disable its default `liara.run`
subdomain** — Settings → زیردامنه پیش‌فرض. There is no creation-time option
and no CLI flag, so this is a manual step and it is the only thing keeping
the API off the public internet. Do it before the first deploy. Attach no
domain to `ds-api`, ever.

## 5. Environment variables

Set with `liara env set`, **never** through `liara.json`'s `envs` key, which
replaces every variable rather than merging.

`ds-api`:

```
NODE_ENV=production
PROCESS_ROLE=all
DATABASE_URL=...
REDIS_URL=...
S3_ENDPOINT=https://storage.iran.liara.site
S3_REGION=default
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true
TRUST_PROXY=1
LOG_LEVEL=info
```

`ds-web`:

```
NODE_ENV=production
API_INTERNAL_URL=http://ds-api:3000
```

`NEXT_PUBLIC_SITE_URL` is **build-time**, not runtime: it is inlined into the
bundle, so it goes in `infra/liara/web.json` under `build.args` and changing
it requires a rebuild.

Production `S3_*` values never enter GitHub secrets.

## 6. First deploy

Follow [first-deploy.md](first-deploy.md) exactly. It ends by setting the
repository variable that enables the CI deploy job.

## 7. Domains

- `.ir` at **nic.ir** directly — cheapest and authoritative. Requires a
  one-time HODA (هدا) identity verification with a national ID and a SIM in
  Saman's name.
- `.com` through an Iranian reseller in Rial — **ParsPack** first choice,
  IranServer fallback. Confirm EPP/transfer-out is available before paying.
  Foreign registrars cannot take Iranian cards and may terminate
  Iran-resident accounts.
- Both nameservers point at ArvanCloud DNS. `.com` 301s to `.ir`.

## 8. ArvanCloud

DNS and CDN on the free plan, in front of `ds-web` only. TLS at Arvan's edge
plus Liara's free automatic TLS at the origin.

**Record the real-IP header name here once confirmed** — `apps/web`'s
`requestApi()` forwards exactly that header as `X-Forwarded-For`, and the API
trusts exactly one hop. Getting this wrong means either no rate limiting or
rate limiting every customer as one IP:

```
ArvanCloud real-IP header: ____________________  (confirmed on: ____________)
```

Also confirm whether the origin can be reached directly, bypassing Arvan.

## 9. Regulatory

- ito.gov.ir registration for half-price domestic traffic (ترافیک نیم‌بها).
- enamad (اینماد) application, once the domain resolves.
- Re-read [../regulatory.md](../regulatory.md) — the supplement licensing
  question is a business risk that predates any of this.
