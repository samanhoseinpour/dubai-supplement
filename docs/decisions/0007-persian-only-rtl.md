# 0007. Persian-only, RTL-only storefront

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

Every customer reads Persian. Supporting a second language costs a translation layer in the catalogue, an i18n library, per-locale routing and bidirectional layout work.

## Considered Options

- **Persian only, permanently** — no i18n library, plain text columns, `dir="rtl"` hard-coded.
- **i18n-ready from the start** — next-intl, translatable catalogue fields, locale routing.
- **Persian now, i18n later** — no library, but keep the data model translatable.

## Decision Outcome

Chosen: **Persian only, permanently**. This is a decision about the business, not about flexibility: the store sells in Iran, in Persian. The storefront hard-codes `<html lang="fa" dir="rtl">`, Tailwind uses logical utilities only (enforced by ESLint), and Vazirmatn is vendored and loaded with `next/font/local` so nothing is fetched from a foreign host at request time.

### Consequences

- Good: No translation layer in the catalogue and no locale routing.
- Good: Logical CSS is enforced by a lint rule, not by review.
- Good: The font is self-hosted, which the Iranian network requires anyway.
- Bad: Adding a second language later would be a rewrite of the layout layer, not a configuration change.
- Bad: The `rtl:` variant is reserved for mirroring directional icons and must not be used for layout.
