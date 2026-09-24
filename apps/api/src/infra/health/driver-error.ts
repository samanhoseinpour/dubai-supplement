/**
 * Drizzle's wrapper peeled off, so a probe reports what actually went wrong.
 *
 * `db.execute()` rejects with a `DrizzleQueryError` whose message is
 * `Failed query: select 1\nparams: ` — it names the statement and nothing
 * else. The driver's own error, which is the diagnosis, rides along as
 * `cause`. Terminus reports `err.message`, so without this every Postgres
 * failure reaches `/health/ready` looking identical, and the three that matter
 * want three different people:
 *
 *  - `connect ECONNREFUSED …`                     — the database is not there
 *  - `Connection terminated due to connection timeout` — it is there and silent
 *  - `timeout exceeded when trying to connect`    — it is fine, the pool is full
 *
 * A human reading a deploy log is one of this endpoint's two consumers, and
 * those have nothing in common but the word "Postgres".
 */
export function unwrapDriverError(error: unknown): unknown {
  return error instanceof Error && error.cause instanceof Error ? error.cause : error
}
