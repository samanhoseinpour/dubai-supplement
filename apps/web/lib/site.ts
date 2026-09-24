// NEXT_PUBLIC_SITE_URL is a build-time input (foundation §7.1): the bundler
// inlines the literal `process.env.NEXT_PUBLIC_SITE_URL` expression, so it is
// written exactly that way and never destructured.
export function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
  if (!raw) {
    throw new Error('NEXT_PUBLIC_SITE_URL is required at build time (foundation §7.1)')
  }
  return new URL(raw)
}
