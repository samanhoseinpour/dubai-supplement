import { describe, expect, it } from 'vitest'
import { isIranMobile, isNationalId, isPostalCode, isSheba } from './validators.js'

describe('isIranMobile', () => {
  it('accepts the common domestic and E.164 forms', () => {
    expect(isIranMobile('09123456789')).toBe(true)
    expect(isIranMobile('+989123456789')).toBe(true)
  })
  it('accepts a number written with Persian digits', () => {
    // Users paste from Persian keyboards constantly; normalize first.
    expect(isIranMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true)
  })
  it('rejects a landline and a truncated number', () => {
    expect(isIranMobile('02112345678')).toBe(false)
    expect(isIranMobile('0912345')).toBe(false)
  })
})

describe('isNationalId', () => {
  it('accepts a checksum-valid id', () => {
    expect(isNationalId('0499370899')).toBe(true)
  })
  it('accepts an id written with Persian digits', () => {
    expect(isNationalId('۰۴۹۹۳۷۰۸۹۹')).toBe(true)
  })
  it('rejects a well-formed but checksum-invalid id', () => {
    expect(isNationalId('1234567890')).toBe(false)
  })
  it('rejects all-same-digit ids, which pass a naive checksum', () => {
    expect(isNationalId('1111111111')).toBe(false)
  })
})

describe('isPostalCode and isSheba', () => {
  it('requires ten digits for a postal code', () => {
    expect(isPostalCode('1234567890')).toBe(true)
    expect(isPostalCode('12345')).toBe(false)
  })
  it('requires the IR prefix and 24 further characters for a sheba', () => {
    expect(isSheba('IR062960000000100324200001')).toBe(true)
    expect(isSheba('062960000000100324200001')).toBe(false)
  })
})
