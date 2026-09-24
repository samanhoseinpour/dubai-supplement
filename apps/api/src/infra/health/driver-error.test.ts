import { describe, expect, it } from 'vitest'
import { unwrapDriverError } from './driver-error.js'

/**
 * A filter helper is only useful if it cannot itself throw: whatever comes
 * back from here is about to become the `message` on a `/health/ready` detail,
 * and an exception raised while reporting an outage replaces a 503 that names
 * the store with a 500 that names nothing.
 *
 * So the shapes below are not hypothetical tidiness. `error.cause` is `unknown`
 * — anything at all may be thrown, and a dependency is free to put a string,
 * an object or nothing there.
 */
describe('unwrapDriverError', () => {
  it('peels drizzle’s wrapper off the driver error', () => {
    const driver = new Error('Connection terminated due to connection timeout')
    const wrapped = new Error('Failed query: select 1\nparams: ', { cause: driver })
    expect(unwrapDriverError(wrapped)).toBe(driver)
  })

  it('peels an Error subclass just the same', () => {
    class DriverError extends Error {}
    const driver = new DriverError('timeout exceeded when trying to connect')
    expect(unwrapDriverError(new Error('wrapped', { cause: driver }))).toBe(driver)
  })

  // Exactly one level, and that is the level worth stopping at: pg builds
  // `Connection terminated due to connection timeout` with the socket error as
  // *its* cause, so unwrapping to the root would report `ECONNRESET` and throw
  // away the only word that says a timeout happened.
  it('peels exactly one level of a deeper chain', () => {
    const socket = new Error('read ECONNRESET')
    const driver = new Error('Connection terminated due to connection timeout', { cause: socket })
    const wrapped = new Error('Failed query: select 1', { cause: driver })
    expect(unwrapDriverError(wrapped)).toBe(driver)
    expect((unwrapDriverError(wrapped) as Error).message).toContain('connection timeout')
  })

  it('returns an Error with no cause unchanged', () => {
    const bare = new Error('connect ECONNREFUSED 127.0.0.1:5432')
    expect(unwrapDriverError(bare)).toBe(bare)
  })

  // `cause` is `unknown`, so none of these is a contract violation by the
  // thrower; each simply has no driver error to find.
  it.each([
    ['a string cause', 'something went wrong'],
    ['an object cause', { code: '57P01' }],
    ['a null cause', null],
    ['an undefined cause', undefined],
    ['a number cause', 500],
  ])('returns the outer error when it has %s', (_label, cause) => {
    const outer = new Error('Failed query: select 1', { cause })
    expect(unwrapDriverError(outer)).toBe(outer)
  })

  // Nothing says a rejection carries an Error at all.
  it.each([
    ['a string', 'boom'],
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a plain object', { message: 'not an Error' }],
  ])('returns %s untouched', (_label, thrown) => {
    expect(unwrapDriverError(thrown)).toBe(thrown)
  })
})
