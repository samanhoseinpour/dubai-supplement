import { afterEach, describe, expect, it, vi } from 'vitest'

const realEnv = process.env

afterEach(() => {
  process.env = realEnv
  vi.resetModules()
})

describe('lib/env', () => {
  it('does not read API_INTERNAL_URL at import time', async () => {
    const reads: string[] = []
    process.env = new Proxy({} as NodeJS.ProcessEnv, {
      get(_target, key) {
        reads.push(String(key))
        return undefined
      },
    })
    await import('../lib/env')
    expect(reads).not.toContain('API_INTERNAL_URL')
  })

  it('rejects a missing API_INTERNAL_URL when called', async () => {
    process.env = { ...realEnv, API_INTERNAL_URL: undefined, NODE_ENV: 'test' }
    const { getServerEnv } = await import('../lib/env')
    expect(() => getServerEnv()).toThrow(/API_INTERNAL_URL/)
  })

  it('rejects a value that is not a URL', async () => {
    process.env = { ...realEnv, API_INTERNAL_URL: 'not a url', NODE_ENV: 'test' }
    const { getServerEnv } = await import('../lib/env')
    expect(() => getServerEnv()).toThrow(/API_INTERNAL_URL/)
  })

  it('returns the parsed environment', async () => {
    process.env = { ...realEnv, API_INTERNAL_URL: 'http://127.0.0.1:9', NODE_ENV: 'test' }
    const { getServerEnv } = await import('../lib/env')
    expect(getServerEnv()).toEqual({ NODE_ENV: 'test', API_INTERNAL_URL: 'http://127.0.0.1:9' })
  })
})
