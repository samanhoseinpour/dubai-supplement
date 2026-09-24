---
paths:
  - 'packages/persian/**'
  - 'packages/contracts/**'
  - 'apps/web/**'
---

# Persian rules

- **`@ds/persian` is the only place** normalization, validation and
  formatting live. Nothing else imports `@persian-tools/persian-tools`.
- **Normalize on write**, in the domain entity: Arabic ي and ك become Persian
  ی and ک, and Persian/Arabic digits become ASCII. HTTP input is normalized
  again by the `persianText` preprocess so both paths agree.
- **`normalizePersian` trims; nothing else does.** Stored text carries no
  leading or trailing whitespace, and because it is trimmed before any
  `.max()` counts, a schema's declared limit is its real limit. Never add a
  trim to `toAsciiDigits` or `toPersianDigits` — both are applied mid-string,
  where the surrounding characters belong to the caller.
- **Format on the server, never in the browser.** ICU data differs between
  runtimes and a client-side format is a hydration mismatch waiting to
  happen.
- **`TEHRAN_TZ = 'Asia/Tehran'` is the single timezone constant.** No literal
  timezone strings anywhere else.
- **ZWNJ (U+200C) is meaningful.** «ماسل‌تک» is one word with a ZWNJ, not two
  words. Search normalizes it to a space in a generated column; display never
  does.
