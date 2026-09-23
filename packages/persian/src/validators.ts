import { verifyIranianNationalId, isShebaValid } from '@persian-tools/persian-tools'
import { toAsciiDigits } from './normalize.js'

const IRAN_MOBILE = /^(?:\+98|0098|98|0)?9\d{9}$/u
const POSTAL_CODE = /^\d{10}$/u
const SHEBA = /^IR\d{24}$/u

export function isIranMobile(value: string): boolean {
  return IRAN_MOBILE.test(toAsciiDigits(value).trim())
}

export function isNationalId(value: string): boolean {
  const ascii = toAsciiDigits(value).trim()
  if (!/^\d{10}$/u.test(ascii)) return false
  // `verifyIranianNationalId` left-pads 8- and 9-digit inputs with zeros and
  // accepts them, so the ten-digit guard above is not redundant.
  return verifyIranianNationalId(ascii)
}

export function isPostalCode(value: string): boolean {
  return POSTAL_CODE.test(toAsciiDigits(value).trim())
}

export function isSheba(value: string): boolean {
  const ascii = toAsciiDigits(value).trim().toUpperCase()
  // `isShebaValid` prepends a missing `IR` before checking, so it would
  // accept a bare 24-digit string; the prefix is required here.
  return SHEBA.test(ascii) && isShebaValid(ascii)
}
