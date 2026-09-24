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
 * Both Postgres indicators.
 *
 * Why it is larger than the Redis ceiling: `attempt()` wraps the whole
 * operation — waiting for a pool client *and* running the statement — and the
 * wait for a client already has a bound of its own, `CONNECT_TIMEOUT_MS`, 3 s
 * (infra/db/connect-timeout.ts). This has to sit above that or it would
 * pre-empt it, answering with terminus's generic `timeout of …ms exceeded` at
 * the moment pg was about to say `timeout exceeded when trying to connect` —
 * which is the message that tells an operator the database is fine and the
 * pool is full. Five seconds leaves two for the statement after a pool wait
 * that spent its entire budget.
 *
 * What is left for it to bound, now that the pool bounds every acquire, is a
 * statement that hangs on a connection it already holds: a lock it never gets,
 * a plan that never finishes. No `statement_timeout` is set, so nothing else
 * stops that one. `health-ready.test.ts` pins it with an ACCESS EXCLUSIVE lock
 * on `outbox_events`, where the probe answers at this ceiling while the query
 * it gave up on is still waiting for the lock — terminus hands `pg` an
 * `AbortSignal` that `pg` does not accept, so the answer is bounded and the
 * work is not.
 *
 * It cannot make a healthy store look down. Measured against the suite's own
 * container: `select 1` warm is p50 0.271 ms / p95 0.547 ms, the outbox count
 * p50 0.637 ms / p95 1.022 ms, and a cold probe that must open the socket and
 * authenticate costs 28 ms — so the ceiling is ~9 000× the warm p95, and the
 * slowest thing measured on a contended host was a 306 ms socket establish.
 */
export const POSTGRES_PROBE_TIMEOUT_MS = 5_000
