import type { ErrorCode } from '@ds/contracts'

// Foundation §7.6 and spec §6.5: every code the API can emit has a Persian
// sentence that says what happened and what to do next; English never
// reaches a customer. The fallback covers a code this build does not know.
// The import is type-only: the client error boundary imports this module, so
// it must carry no runtime dependency on the contracts package.
const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'اطلاعات واردشده درست نیست. موارد مشخص‌شده را اصلاح کنید.',
  UNAUTHORIZED: 'برای ادامه باید وارد حساب خود شوید.',
  FORBIDDEN: 'شما اجازهٔ دسترسی به این بخش را ندارید. به صفحهٔ اصلی برگردید.',
  NOT_FOUND: 'چیزی که دنبال آن هستید پیدا نشد. نشانی را بررسی کنید یا به صفحهٔ اصلی برگردید.',
  CONFLICT: 'این درخواست با وضعیت فعلی تداخل دارد. صفحه را تازه کنید و دوباره تلاش کنید.',
  RATE_LIMITED: 'تعداد درخواست‌ها بیش از حد است. کمی صبر کنید و دوباره تلاش کنید.',
  INTERNAL: 'مشکلی در سمت ما پیش آمد. دوباره تلاش کنید.',
  CATALOG_BRAND_NOT_FOUND: 'برند موردنظر پیدا نشد. فهرست برندها را ببینید.',
  CATALOG_BRAND_SLUG_TAKEN: 'این نشانی برند قبلاً استفاده شده است. نشانی دیگری انتخاب کنید.',
}

export const FALLBACK_MESSAGE = 'مشکلی پیش آمد. دوباره تلاش کنید.'

function isErrorCode(code: string): code is ErrorCode {
  return Object.hasOwn(MESSAGES, code)
}

export function errorMessage(code: string): string {
  return isErrorCode(code) ? MESSAGES[code] : FALLBACK_MESSAGE
}
