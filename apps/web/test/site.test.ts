import { afterEach, describe, expect, it } from 'vitest'
import { siteUrl } from '../lib/site'

const realEnv = process.env

afterEach(() => {
  process.env = realEnv
})

describe('siteUrl', () => {
  it('parses NEXT_PUBLIC_SITE_URL', () => {
    process.env = { ...realEnv, NEXT_PUBLIC_SITE_URL: 'https://example.ir' }
    expect(siteUrl().href).toBe('https://example.ir/')
  })

  it('fails loudly when the build-time value is missing', () => {
    process.env = { ...realEnv, NEXT_PUBLIC_SITE_URL: undefined }
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/)
  })
})
