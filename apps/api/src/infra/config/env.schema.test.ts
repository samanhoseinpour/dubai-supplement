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
})
