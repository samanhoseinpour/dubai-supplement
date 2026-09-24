import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { AppConfig, ConfigModule } from '../../src/infra/config/index.js'
import { KeyValueStore, RedisModule } from '../../src/infra/redis/index.js'
import { flushRedis } from '../setup/truncate.js'

describe('KeyValueStore', () => {
  let store: KeyValueStore
  let redisUrl: string
  let close: () => Promise<void>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule],
    }).compile()
    const app = await moduleRef.init()
    store = app.get(KeyValueStore)
    // The app's own URL, not process.env: the instance emptied below is the
    // instance the assertions then read, by construction — the shape
    // test/setup/fixture.ts uses. `beforeEach(flushRedis)` would instead hand
    // the hook vitest's TestContext as its first argument and never flush
    // this app's Redis at all; harness.test.ts pins where that goes.
    redisUrl = app.get(AppConfig).redisUrl
    close = () => app.close()
  })

  beforeEach(async () => {
    await flushRedis(redisUrl)
  })

  afterAll(async () => {
    await close()
  })

  it('round-trips a value', async () => {
    await store.set('k', 'v')
    expect(await store.get('k')).toBe('v')
  })

  it('returns null for a missing key rather than throwing', async () => {
    expect(await store.get('absent')).toBeNull()
  })

  /**
   * Both halves are the test. A key that was never written is also absent
   * after 1200ms, so the disappearance on its own says nothing about the TTL
   * branch — measured: with `set()`'s ttl branch replaced by a no-op that
   * writes nothing, the absence assertion alone still passed. The read
   * before the wait is what distinguishes "expired" from "never stored".
   */
  it('honours a TTL: the value is there, then it is not', async () => {
    await store.set('short', 'v', 1)
    expect(await store.get('short')).toBe('v')

    await new Promise((r) => setTimeout(r, 1200))
    expect(await store.get('short')).toBeNull()
  })

  it('deletes', async () => {
    await store.set('k', 'v')
    await store.del('k')
    expect(await store.get('k')).toBeNull()
  })
})
