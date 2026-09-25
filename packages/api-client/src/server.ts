import 'server-only'
import { createApiClient, type ApiClient } from './index.js'

let client: ApiClient | undefined

function baseUrl(): string {
  const raw = process.env['API_INTERNAL_URL']
  if (raw === undefined || raw === '') {
    throw new Error(
      'API_INTERNAL_URL is not set; the storefront reads it at request time (foundation §7.1)',
    )
  }
  return new URL(raw).href
}

/**
 * The storefront's server-side client (foundation §7.4): no request context,
 * so it may run inside 'use cache'. Built on first use, never at import —
 * `next build` runs with API_INTERNAL_URL on a closed port and must not care
 * (DoD 9). One client per process; 'use cache' memoises the calls.
 */
export function getPublicApi(): ApiClient {
  client ??= createApiClient({ baseUrl: baseUrl() })
  return client
}

/** `publicApi.GET(...)` reads like a client and resolves to the singleton on first use. */
export const publicApi: ApiClient = new Proxy({} as ApiClient, {
  get(_target, property): unknown {
    const real = getPublicApi() as unknown as Record<PropertyKey, unknown>
    const value = real[property]
    return typeof value === 'function' ? value.bind(real) : value
  },
})
