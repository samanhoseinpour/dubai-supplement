import { describe, expect, it } from 'vitest'
import { EnvSchema } from './env.schema.js'

const valid = {
  DATABASE_URL: 'postgres://dubaisupp:dubaisupp@127.0.0.1:5432/dubaisupp',
  REDIS_URL: 'redis://127.0.0.1:6379/0',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_BUCKET: 'dubaisupp',
  S3_ACCESS_KEY_ID: 'rustfsadmin',
  S3_SECRET_ACCESS_KEY: 'rustfsadmin',
}

describe('EnvSchema', () => {
  it('boots from only the six required keys, defaulting the rest', () => {
    const env = EnvSchema.parse(valid)
    expect(env.PROCESS_ROLE).toBe('api')
    expect(env.PORT).toBe(3001)
    expect(env.OUTBOX_POLL_MS).toBe(1000)
    expect(env.S3_REGION).toBe('default')
    expect(env.S3_FORCE_PATH_STYLE).toBe(true)
    expect(env.CORS_ORIGINS).toEqual([])
  })

  it('refuses to boot when a required key is missing', () => {
    const { DATABASE_URL: _DATABASE_URL, ...withoutDb } = valid
    expect(() => EnvSchema.parse(withoutDb)).toThrow()
  })

  // Review Focus 3. A hop count is what the spec originally specified and
  // what any reader would reach for; Fastify accepts it and then trusts
  // nothing, silently (ADR-0001). It must fail loudly here instead.
  it('rejects a numeric TRUST_PROXY rather than coercing it', () => {
    expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: '1' })).toThrow(/never a number/iu)
    expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: '0' })).toThrow(/never a number/iu)
  })

  it('rejects boolean TRUST_PROXY, which would trust every hop', () => {
    expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: 'true' })).toThrow()
  })

  it('accepts a preset list and a CIDR list', () => {
    expect(EnvSchema.parse({ ...valid, TRUST_PROXY: 'loopback,uniquelocal' }).TRUST_PROXY).toBe(
      'loopback,uniquelocal',
    )
    expect(EnvSchema.parse({ ...valid, TRUST_PROXY: '10.0.0.0/8' }).TRUST_PROXY).toBe('10.0.0.0/8')
  })

  it('splits CORS_ORIGINS and rejects the wildcard', () => {
    expect(
      EnvSchema.parse({ ...valid, CORS_ORIGINS: 'https://a.ir,https://b.ir' }).CORS_ORIGINS,
    ).toEqual(['https://a.ir', 'https://b.ir'])
    expect(() => EnvSchema.parse({ ...valid, CORS_ORIGINS: '*' })).toThrow()
    expect(() => EnvSchema.parse({ ...valid, CORS_ORIGINS: 'null' })).toThrow()
  })

  it('rejects an unknown PROCESS_ROLE', () => {
    expect(() => EnvSchema.parse({ ...valid, PROCESS_ROLE: 'relay' })).toThrow()
  })

  it('accepts every proxy-addr preset and bare or prefixed IPv4 and IPv6 addresses', () => {
    for (const value of [
      'loopback',
      'linklocal',
      'uniquelocal',
      '203.0.113.7',
      '10.0.0.0/8',
      '2001:db8::1',
      'fd00::/8',
      'loopback, 10.0.0.0/8',
    ]) {
      expect(EnvSchema.parse({ ...valid, TRUST_PROXY: value }).TRUST_PROXY).toBe(value)
    }
  })

  // A typo'd preset would otherwise surface from proxy-addr while the
  // adapter is built, nowhere near the key that caused it. (ZodError's
  // message is JSON, so the quotes around the entry arrive escaped.)
  it('rejects a misspelled preset, naming the entry', () => {
    expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: 'loopbak' })).toThrow(
      /TRUST_PROXY entry .*loopbak/u,
    )
    expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: 'loopback,uniquelocl' })).toThrow(
      /TRUST_PROXY entry .*uniquelocl/u,
    )
  })

  it('rejects malformed addresses, prefix lengths and empty entries', () => {
    for (const value of [
      'not-an-ip',
      '10.0.0.256/8',
      '10.0.0.0/33',
      'fd00::/129',
      '10.0.0.0/x',
      '10.0.0.0/8,',
      ',loopback',
    ]) {
      expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: value })).toThrow(/TRUST_PROXY entry/u)
    }
  })

  // 0.0.0.0/0 and ::/0 are what `true` means, spelled as a CIDR. Rejecting
  // one spelling of "trust everything" while accepting the other is no guard.
  it('rejects a /0 prefix, which trusts every address exactly as true would', () => {
    for (const value of ['0.0.0.0/0', '::/0', 'loopback,10.0.0.0/0']) {
      expect(() => EnvSchema.parse({ ...valid, TRUST_PROXY: value })).toThrow(
        /trusts every address/u,
      )
    }
  })
})
