import { afterEach, describe, expect, it, vi } from 'vitest'

// The client is a process-wide singleton, so the module is loaded afresh per
// test; `server-only` is aliased to a stub in vitest.config.ts.
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('publicApi', () => {
  it('reads nothing at import and fails clearly on first use without the variable', async () => {
    vi.stubEnv('API_INTERNAL_URL', '')
    const { publicApi } = await import('./server.js')
    expect(() => publicApi.GET).toThrow(/API_INTERNAL_URL/)
  })

  it('builds one client from API_INTERNAL_URL on first use', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://127.0.0.1:9')
    const { getPublicApi, publicApi } = await import('./server.js')
    expect(getPublicApi()).toBe(getPublicApi())
    expect(typeof publicApi.GET).toBe('function')
  })
})
