/**
 * How long any database operation may wait to get a connection.
 *
 * A leaf with no imports, for the same reason `migration-lock.ts` is one: both
 * pools in this repository need it, and one of them is built by `src/migrate.ts`,
 * which stays free of Nest so `tsx` may run it (§4.2). Either barrel would drag
 * `ConfigModule` in, whose `forRoot` validates the environment the moment it is
 * imported — before `migrate.ts` has loaded its own `.env`. So `migrate.ts`
 * imports this file directly, exactly as it does the lock key.
 *
 * A constant rather than env, for the reason `infra/http/throttle.ts` gives for
 * the rate limit: `DATABASE_POOL_MAX` sizes the pool, this decides what happens
 * when the size is not enough, and a failure policy that varies per environment
 * is one nobody can reason about.
 *
 * Read out of pg-pool 3.14.0 rather than assumed: the option covers **two**
 * waits, not one.
 *
 *  - `connect()` (index.js:199-236) — waiting in `_pendingQueue` for a busy
 *    pool to release a client. Without the option, the pending item is queued
 *    with no timer at all. With it: `timeout exceeded when trying to connect`.
 *  - `newClient()` (index.js:240-262) — establishing a socket. Without the
 *    option, `client.connect()` has no bound whatsoever. With it:
 *    `Connection terminated due to connection timeout`.
 *
 * So the floor is set by ordinary load, not by the network. Measured at this
 * value against the suite's own container:
 *
 *  - blackholed address → rejected in 3002 ms (was: still pending at 15 002 ms)
 *  - every client held  → rejected in 3002 ms (was: pending forever)
 *  - queued behind 10 × `pg_sleep(1)` → **resolved in 979 ms**, well clear
 *  - queued behind 10 × `pg_sleep(4)` → rejected in 3001 ms
 *
 * 3 s is therefore ~3× the wait a fully saturated pool of one-second statements
 * imposes, and only trips when every client is held by something slower than
 * three seconds — a database in trouble, where failing fast is the point of a
 * pool timeout. Nothing this API runs comes close. Re-measured under 24-worker
 * CPU contention (a 3.4× slowdown, roughly CI's 2-vCPU runner): the queue-wait
 * term does not move with host load, and the worst socket establish produced
 * was 306 ms, an order of magnitude under budget.
 *
 * It sits deliberately below the health probes' own 5 s ceiling
 * (infra/health/probe-timeout.ts), so a connection problem is reported with
 * pg's specific message and the acquire is actually abandoned, rather than
 * being abandoned only by the probe while the acquire waits on.
 */
export const CONNECT_TIMEOUT_MS = 3_000
