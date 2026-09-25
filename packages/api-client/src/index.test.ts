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

  it('substitutes a path parameter and returns a typed brand', async () => {
    const brand = {
      id: '0199f3c0-1111-7000-8000-000000000000',
      slug: 'muscletech',
      name: 'ماسل‌تک',
      createdAt: '2026-09-25T12:00:00.000Z',
      updatedAt: '2026-09-25T12:00:00.000Z',
    }
    const { fetch, calls } = fakeFetch(200, brand)
    const api = createApiClient({ baseUrl: BASE, fetch })
    const { data } = await api.GET('/catalog/brands/{slug}', {
      params: { path: { slug: 'muscletech' } },
    })
    expect(data?.name).toBe('ماسل‌تک')
    expect(calls[0]?.url).toBe('http://api.internal:3001/catalog/brands/muscletech')
  })

  it('turns the catalog 404 into an ApiError the storefront can branch on', async () => {
    const problem = {
      type: 'urn:problem:CATALOG_BRAND_NOT_FOUND',
      title: 'Brand Not Found',
      status: 404,
      instance: 'req-2',
      code: 'CATALOG_BRAND_NOT_FOUND',
      detail: 'No brand has the slug "nope"',
    }
    const { fetch } = fakeFetch(404, problem, 'application/problem+json')
    const api = createApiClient({ baseUrl: BASE, fetch })
    await expect(
      api.GET('/catalog/brands/{slug}', { params: { path: { slug: 'nope' } } }),
    ).rejects.toMatchObject({ code: 'CATALOG_BRAND_NOT_FOUND', status: 404 })
  })
})
