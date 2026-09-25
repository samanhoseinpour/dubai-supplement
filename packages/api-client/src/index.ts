import createClient, { type Client, type Middleware } from 'openapi-fetch'
import type { paths } from './generated/schema.js'
import { ApiError, isProblemDetails } from './errors.js'

export { ApiError } from './errors.js'
export type { paths } from './generated/schema.js'

export type ApiClient = Client<paths>

export type ApiClientOptions = {
  readonly baseUrl: string
  /** Sent on every request; requestApi() (the identity spec) will forward cookies and ids through it. */
  readonly headers?: Record<string, string>
  /** For tests: what openapi-fetch calls instead of the global fetch. */
  readonly fetch?: (input: Request) => Promise<Response>
}

/**
 * openapi-fetch over the generated paths (foundation §8.2). A response that
 * is not ok becomes an `ApiError` in middleware, so a caller gets `data` or
 * an exception — never an `{ error }` branch to forget.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  })
  client.use(problemToError)
  return client
}

const problemToError: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return undefined
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined)
    if (isProblemDetails(body)) throw new ApiError(body)
    throw new ApiError({
      type: 'about:blank',
      title: response.statusText || `HTTP ${String(response.status)}`,
      status: response.status,
      instance: response.headers.get('x-request-id') ?? '',
      code: 'INTERNAL',
    })
  },
}
