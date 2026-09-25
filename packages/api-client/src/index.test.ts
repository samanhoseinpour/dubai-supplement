import { describe, expect, it } from 'vitest'
import { ApiError, createApiClient } from './index.js'

function fakeFetch(status: number, body: unknown, contentType = 'application/json') {
  const calls: Request[] = []
  const fetch = (input: Request): Promise<Response> => {
    calls.push(input)
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': contentType },
      }),
    )
  }
  return { fetch, calls }
}

const BASE = 'http://api.internal:3001'

describe('createApiClient', () => {
  it('resolves data on a 200 and builds the URL from the base', async () => {
    const { fetch, calls } = fakeFetch(200, { status: 'ok' })
    const api = createApiClient({ baseUrl: BASE, fetch })
    const { data } = await api.GET('/health/live')
    expect(data).toMatchObject({ status: 'ok' })
    expect(calls[0]?.url).toBe('http://api.internal:3001/health/live')
  })

  it('throws an ApiError carrying the problem on a problem+json response', async () => {
    const problem = {
      type: 'urn:problem:RATE_LIMITED',
      title: 'Rate Limited',
      status: 429,
      instance: 'req-1',
      code: 'RATE_LIMITED',
      detail: 'Try again later',
    }
    const { fetch } = fakeFetch(429, problem, 'application/problem+json')
    const api = createApiClient({ baseUrl: BASE, fetch })
    const attempt = api.GET('/health/live')
    await expect(attempt).rejects.toBeInstanceOf(ApiError)
    await expect(attempt).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      instance: 'req-1',
      detail: 'Try again later',
      message: 'Try again later',
    })
  })

  it('maps a failure that is not a problem to INTERNAL with the status', async () => {
    const { fetch } = fakeFetch(502, undefined, 'text/html')
    const api = createApiClient({ baseUrl: BASE, fetch })
    await expect(api.GET('/health/live')).rejects.toMatchObject({ code: 'INTERNAL', status: 502 })
  })

  it('sends the default headers', async () => {
    const { fetch, calls } = fakeFetch(200, { status: 'ok' })
    const api = createApiClient({ baseUrl: BASE, headers: { 'x-request-id': 'abc' }, fetch })
    await api.GET('/health/live')
    expect(calls[0]?.headers.get('x-request-id')).toBe('abc')
  })
})
