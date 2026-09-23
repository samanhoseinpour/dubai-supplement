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

### Consequences

- Good: Rate limits survive a restart and are ready for a second instance.
- Good: The fallback is small, local and keeps the Redis client consistent.
- Bad: An override silences a real peer mismatch; the spike must actually exercise the throttler, not just boot it.
- Bad: `@nestjs/throttler` 6.7.0 masks IPv6 trackers to `/64`, so throttle keys rotate once on upgrade.
