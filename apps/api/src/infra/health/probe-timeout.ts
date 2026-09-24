/**
 * The ceilings that make `/health/ready` always answer.
 *
 * The three indicators run concurrently, so the endpoint's own worst case is
 * the largest of these. Without them it has none: a store that neither answers
 * nor refuses leaves the probe pending forever, and a probe that does not
 * answer is not a report — Liara's health checker sees a timeout and learns
 * nothing about which store is away.
 *
 * Both values are measured against the suite's own containers rather than
 * chosen, and both are picked so that they cannot make a healthy store look
 * down.
 */

/**
 * 200 serial PINGs measured p50 0.219 ms, p95 0.382 ms. Against a closed port
 * ioredis queues the command and rejects it only after twenty reconnect
 * attempts — `MaxRetriesPerRequestError` at ~10.5 s — so this both bounds the
 * probe and halves it. Four orders of magnitude above p95.
 */
export const REDIS_PROBE_TIMEOUT_MS = 2_000

/**
 * Both Postgres indicators. Larger than the Redis ceiling for one reason,
 * which is the pool: a probe does not just run a statement, it first waits for
 * a client, and `pg.Pool` has no `connectionTimeoutMillis` here.
 *
 * Measured: `select 1` warm is p50 0.271 ms / p95 0.547 ms and the outbox
 * count p50 0.637 ms / p95 1.022 ms; a cold probe that must open the socket
 * and authenticate costs 28 ms; but a probe arriving while all
 * `DATABASE_POOL_MAX` clients are busy waits for one to come free — with ten
 * clients each held by a one-second statement, that measured 954 ms. So the
 * ceiling has to clear a saturated pool, not just a query, or ordinary load
 * would report Postgres down. Five seconds clears a pool saturated by
 * statements of up to ~4 s, which is far beyond anything this API runs, and
 * is still ~9 000× the warm p95.
 *
 * What it bounds, measured: `select 1` through a pool pointed at a blackholed
 * address — no refusal, no reset, just silence — was **still pending after
 * 15 002 ms**. Unlike ioredis, nothing in `pg` ever gives up.
 */
export const POSTGRES_PROBE_TIMEOUT_MS = 5_000
