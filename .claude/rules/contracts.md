---
paths:
  - 'packages/contracts/**'
---

# Contract rules

- **Zod 4 top-level forms:** `z.uuid()`, `z.iso.datetime()`, `z.email()` —
  not the deprecated `z.string().uuid()` style.
- **Validation results expose `issues`, never `errors`.**
- **Zod 4.6 behaviour to design around:**
  - `z.iso.datetime()` **requires seconds**. Every timestamp the API emits
    must be full ISO-8601 with seconds — assert it in a contract test rather
    than discovering it through a 400.
  - `.min()`, `.max()` and `.length()` count **code points**, not UTF-16
    units. This is the semantics we want: `persianText(200)` measures Persian
    the way a human counts it, and a ZWNJ (U+200C) costs exactly one.
  - `__proto__` is always stripped from parsed objects.
- **Contracts describe HTTP shapes, never domain entities.** `apps/web` must
  never be able to import the API's domain.
