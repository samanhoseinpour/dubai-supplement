import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { Logger } from '@nestjs/common'
import type { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
// The config barrel evaluates `ConfigModule`, whose `forRoot({ envFilePath:
// '.env', validate })` runs at decoration time, so this file needs a
// schema-valid environment at import — vitest.config.ts supplies one.
import { AppConfig, EnvSchema } from '../config/index.js'
import type { Db } from '../db/index.js'
import { OutboxRelay, type RelayCycle } from './outbox.relay.js'

/**
 * The polling loop, with no database and no clock.
 *
 * `.claude/rules/testing.md` says outbox tests call `runOnce()` directly and
 * never start the relay loop and sleep — which rules out reaching start() and
 * stop() from the integration suite, not reaching them at all. Fake timers
 * and a stubbed cycle exercise the loop without a tick ever running a real
 * one, so nothing here needs Docker and nothing here waits.
 */
const POLL_MS = 250

const build = (): OutboxRelay =>
  new OutboxRelay(
    // Never reached: no cycle below runs the real runOnce().
    {} as Db,
    {} as DiscoveryService,
    {} as MetadataScanner,
    {} as Reflector,
    new AppConfig(
      EnvSchema.parse({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://u:p@127.0.0.1:1/d',
        REDIS_URL: 'redis://127.0.0.1:1/0',
        S3_ENDPOINT: 'http://127.0.0.1:1',
        S3_BUCKET: 'b',
        S3_ACCESS_KEY_ID: 'k',
        S3_SECRET_ACCESS_KEY: 's',
        OUTBOX_POLL_MS: String(POLL_MS),
      }),
    ),
  )

const aCycle = (): RelayCycle => ({ processed: 0, failed: 0 })

describe('OutboxRelay.start / stop', () => {
  // Every start() below announces itself, so the spy is installed for the
  // whole describe rather than in the one test that reads it — otherwise four
  // tests that say nothing about logging would print through vitest's own
  // output. `restoreAllMocks` in afterEach puts the method back.
  let logged: MockInstance<typeof Logger.prototype.log>

  beforeEach(() => {
    logged = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // The assertion the integration suite cannot make without sleeping on a
  // real loop: stop() releases the handle rather than only setting a flag. A
  // relay that sets the flag alone still stops delivering — the flag is
  // checked first thing in the tick — so behaviour cannot see the difference,
  // and the symptom is a container that will not exit on SIGTERM.
  it('holds exactly one interval while started and none once stopped', async () => {
    vi.useFakeTimers()
    const relay = build()

    expect(vi.getTimerCount()).toBe(0)
    relay.start()
    expect(vi.getTimerCount()).toBe(1)

    // Idempotent: a second start() must not leave an interval behind that the
    // single clearInterval() in stop() can never reach.
    relay.start()
    expect(vi.getTimerCount()).toBe(1)

    await relay.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  // `first-deploy.md` §4 is the only guard the runbook has against a container
  // that serves HTTP and relays nothing: AppModule is identical under every
  // PROCESS_ROLE, so the boot log is otherwise byte-identical and an operator
  // has nothing to look at. The line is the whole check, which is why it is
  // asserted verbatim rather than by a substring.
  it('announces itself once per start, so an operator can see the relay is on', async () => {
    vi.useFakeTimers()
    const relay = build()
    vi.spyOn(relay, 'runOnce').mockResolvedValue(aCycle())

    relay.start()
    expect(logged).toHaveBeenCalledWith({ msg: 'outbox relay started', pollMs: POLL_MS })

    // The idempotent second start() takes the early return, so it must not
    // announce a relay it did not start.
    relay.start()
    expect(logged).toHaveBeenCalledTimes(1)

    await relay.stop()
  })

  it('runs a cycle every OUTBOX_POLL_MS', async () => {
    vi.useFakeTimers()
    const relay = build()
    const runOnce = vi.spyOn(relay, 'runOnce').mockResolvedValue(aCycle())

    relay.start()
    await vi.advanceTimersByTimeAsync(POLL_MS - 1)
    expect(runOnce).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(runOnce).toHaveBeenCalledTimes(1)

    await relay.stop()
    await vi.advanceTimersByTimeAsync(3 * POLL_MS)
    expect(runOnce).toHaveBeenCalledTimes(1)
  })

  // A batch of fifty holds one connection for the sum of its handlers'
  // latencies, so a cycle can outlast the interval. Without the guard every
  // tick in that window takes another pooled connection, and `inFlight`
  // becomes the newest of several — so stop() would drain the wrong one while
  // claiming in its comment that SIGTERM cannot cut a cycle in half.
  it('does not start a second cycle on top of one still running', async () => {
    vi.useFakeTimers()
    const relay = build()
    let finish = (): void => undefined
    const held = new Promise<RelayCycle>((resolve) => {
      finish = () => {
        resolve(aCycle())
      }
    })
    const runOnce = vi.spyOn(relay, 'runOnce').mockReturnValue(held)

    relay.start()
    await vi.advanceTimersByTimeAsync(4 * POLL_MS)
    expect(runOnce).toHaveBeenCalledTimes(1)

    // And the guard opens again once the cycle ends, rather than wedging the
    // loop shut for the life of the process.
    finish()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(runOnce).toHaveBeenCalledTimes(2)

    finish()
    await relay.stop()
  })

  // A failure at the transaction level reaches none of runOnce()'s per-row
  // catches: `attempts` never moves, so the rows stay unpublished at zero
  // attempts and the `outbox.dead` readiness count — which sees parked rows
  // only — never notices. Without this line the sole symptom is silence.
  it('logs a cycle that failed at the transaction level instead of swallowing it', async () => {
    vi.useFakeTimers()
    const relay = build()
    const failure = new Error('Cannot use a pool after calling end on the pool')
    vi.spyOn(relay, 'runOnce').mockRejectedValue(failure)
    // Mocked rather than merely observed, so the suite's own output stays
    // clean while the call is asserted.
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    relay.start()
    await vi.advanceTimersByTimeAsync(POLL_MS)

    // One object carrying `err`, not `error('…', failure)`: Nest appends its
    // context as the final argument and nestjs-pino hands a string message's
    // remaining params to pino as interpolation arguments, where an Error
    // with no placeholder to fill is dropped.
    expect(logged).toHaveBeenCalledWith({ err: failure, msg: 'outbox cycle failed' })

    // Swallowed *after* being recorded: the loop keeps polling, because the
    // rows the failed cycle never reached are still there to be found.
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(logged).toHaveBeenCalledTimes(2)

    await relay.stop()
  })
})
