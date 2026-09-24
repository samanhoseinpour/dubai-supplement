# 0017. Redis throttler storage under a peer override

- Status: accepted
- Date: 2026-09-23

## Context and Problem Statement

`@nestjs/throttler` needs Redis-backed storage so rate limits survive a restart and would hold across instances. `@nest-lab/throttler-storage-redis` 1.2.0 is the ioredis-based option, and it still caps its peers at `@nestjs/core ^11.0.0` with no upstream PR or issue as of 2026-09-23.

## Considered Options

- **`@nest-lab` 1.2.0 under a `peerDependencyRules.allowedVersions` override.**
- **Hand-roll a `ThrottlerStorage`** over ioredis in `src/infra/redis`.
- **`@nestjs-redis/throttler-storage` 2.0.1**, which supports Nest 12 but requires node-redis.

## Decision Outcome

Chosen: **`@nest-lab` under an override**, with fallbacks in a fixed order. The package implements only a storage interface — `increment` against Redis — so the risk of a Nest 12 incompatibility is low, but it is genuinely unverified until the Phase 2 spike boots it. If it misbehaves under ESM, fall back to the hand-rolled ioredis storage (preferred: it keeps ioredis and the code is perhaps forty lines); only if that fails too, switch to `@nestjs-redis/throttler-storage`, which would mean replacing ioredis with node-redis across the whole API.

This is the **only** remaining peer override. `@nestjs/terminus` 12.1.0, `@nestjs/throttler` 6.7.0 and `nestjs-pino` 5.2.0 all declare Nest 12 peers now, so the other three overrides the spec listed were deleted.

### Amendment, 2026-09-24 (Task 15)

The two health routes are exempt: `HealthController` carries `@SkipThrottle()`, so `/health/live` and `/health/ready` are counted for no caller.

The guard's storage is the point. `ThrottlerGuard` is a global `APP_GUARD`, so counting a probe means reaching Redis _before_ the route runs — measured, `GET /health/live` against an unanswering Redis returned **500 after 10.5 s**, the guard waiting out ioredis's twenty reconnect attempts before `MaxRetriesPerRequestError` fell through to `ProblemFilter`. The Docker `HEALTHCHECK` points at `/health/live` precisely so a Redis blip does not restart-loop the container, and that is exactly what a 500 there would do. Two reasons this is affordable: the API is not publicly reachable (north star §4), so the only callers are Liara's health checker and the container's own probe; and a rate limiter that cannot be reached without the store it protects is no limiter at all.

Pinned from both sides in `security.test.ts` (no Redis bucket for either route) and `health-ready.test.ts` (liveness still 200, readiness still 503 naming redis, with Redis away).

### Consequences

- Good: Rate limits survive a restart and are ready for a second instance.
- Good: The fallback is small, local and keeps the Redis client consistent.
- Bad: An override silences a real peer mismatch; the spike must actually exercise the throttler, not just boot it.
- Bad: `@nestjs/throttler` 6.7.0 masks IPv6 trackers to `/64`, so throttle keys rotate once on upgrade.
- Bad: the health routes are unthrottled, so a caller inside the private network can poll them without limit; each `/health/ready` costs one `select 1`, one counted index scan and one `PING`.
