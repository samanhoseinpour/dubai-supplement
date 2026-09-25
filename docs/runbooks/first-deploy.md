# First deploy

Seven things are assumed by the design but unverified until a real deploy.
Check each one, in this order, and write the answer down. Several of them
are cheap now and expensive later.

Trigger the deploy with `deploy.yml` via `workflow_dispatch` — not by
pushing, because the `deploy` job stays skipped until step 7.

## 1. ICU collation and character type — before the first migration

`brands.name` is ordered with `COLLATE "fa"`, which needs an ICU-enabled
PostgreSQL build. Liara's is unverified.

```sql
SELECT count(*) FROM pg_collation WHERE collprovider = 'i';
```

- **Non-zero:** ICU is available. Migration `0000_extensions` creates
  `COLLATION fa` as written.
- **Zero:** ICU is not available. Do **not** run the migration. Replace the
  collation with ordering on `search_text` and record it as an ADR.

Run this **before** the first migration. Afterwards it is a migration to
undo rather than a line to change.

In the same session, check the database's character-type locale:

```sql
SELECT datctype FROM pg_database WHERE datname = current_database();
```

- **Anything but `C` or `POSIX`** — a UTF-8 locale such as `en_US.utf8`:
  continue.
- **`C` or `POSIX`:** do **not** run the migration. Get a database created
  with a UTF-8 `LC_CTYPE` first, while this one is still empty.

PostgreSQL 16's `pg_trgm` extracts no trigrams from Persian text when
`LC_CTYPE` is `C` (its `t_isalnum` falls back to byte-wise `isalnum`), so
`brands_search_text_idx` would be useless for Persian search, and `datctype`
is fixed when the database is created — fixing it later means recreating the
database.

**Then the first migration, and the seed.** With both checks passed, the
first deploy migrates: `ds-api`'s entrypoint runs `node dist/migrate.js`
before it starts the server (§3). Once that deploy is up, run the seed
once, in the `ds-api` container:

```sh
node dist/seed.js
```

It is the entrypoint `pnpm db:seed` runs locally. It writes the store's nine
brands through `BrandService`, each with its `catalog.brand.created` outbox
event, and it is idempotent by slug, so re-running it is safe. Expected: its
`seed finished` line lists nine slugs under `created` — a re-run lists them
under `skipped` and writes nothing. The events wait in `outbox_events` until
`ds-api`'s relay (§4) delivers them, one `brand created` line each.

## 2. Trusted proxy hops

`TRUST_PROXY=1` assumes exactly one proxy between the client and the API.
Confirm the real chain. Too low and the client IP is wrong; too high and any
caller can spoof `X-Forwarded-For`, which defeats per-IP rate limiting and,
later, per-phone OTP throttling.

Also confirm ArvanCloud's real-IP header name and record it in
[go-live.md](go-live.md).

## 3. Health-check cadence

Liara documents `interval`, `timeout` and `startPeriod` in **milliseconds**,
but its own example reads as though they were seconds. Confirm the effective
cadence from the deploy events before trusting the numbers, and confirm what
the probe does on failure.

`startPeriod` must be at least 60 s: migrations run in the entrypoint, and
old and new containers overlap during a zero-downtime rollover.

## 4. The relay actually started

`ds-api` runs with `PROCESS_ROLE=all`, which starts the HTTP app **and** the
outbox relay in one process. Every role boots the same module graph, so the
rest of the boot log is identical under `api` and under `all`; the relay's own
start line, written once, is the only thing that tells them apart:

```sh
liara logs -a ds-api | grep 'outbox relay started'
```

Expected: exactly one line, from `OutboxRelay`, carrying the poll interval —

```text
{"level":30,"context":"OutboxRelay","msg":"outbox relay started","pollMs":1000}
```

(`time`, `pid` and `hostname` are elided above; `pollMs` is `OUTBOX_POLL_MS`.)

No line means the container is serving HTTP and relaying nothing: domain
events accumulate in `outbox_events` and nothing reacts — silently. Check
`PROCESS_ROLE` and redeploy.

## 5. The API is not reachable from the internet

From **outside** the private network:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://<ds-api>.liara.run
```

Expected: it does not answer. If it does, the default subdomain was not
disabled — go back to [go-live.md](go-live.md) step 4 before continuing.

## 6. Object storage

Run the storage smoke test once against Liara, with a key scoped to the
production bucket:

```sh
S3_ENDPOINT=https://storage.iran.liara.site S3_REGION=default \
S3_BUCKET=<bucket> S3_ACCESS_KEY_ID=<id> S3_SECRET_ACCESS_KEY=<secret> \
pnpm --filter api test:storage
```

These values come from the operator's shell. **They never enter GitHub
secrets.**

## 7. Enable CI deploys

Only after 1–6 pass, set the repository variable:

```
LIARA_DEPLOY_ENABLED=true
```

Until then the CI `deploy` job is skipped, which is what lets `ci.yml` stay
green on `main` before Liara exists.
