---
paths:
  - 'docs/**'
---

# Documentation rules

- **A new term means a glossary row.** If you introduce a concept with a
  Persian name, add it to `docs/glossary.md` with its code identifier in the
  same change. Two names for one thing is how a ubiquitous language dies.
- **A new decision means an ADR.** Anything that closes off an alternative
  goes in `docs/decisions/NNNN-title.md`, built from `0000-template.md` and
  carrying all three MADR headings. Use the `adr` skill, which picks the next
  free number.
- **An ADR records what would reverse it.** A decision with no stated
  reversal condition is an opinion.
- **`north-star.md` is loaded on every task**, so it stays short and holds
  only what must never be re-derived: contexts, dependency directions,
  invariants, non-goals.
- **Relative links must resolve case-exactly** — macOS is case-insensitive
  and the CI runner is not. `pnpm check:docs` enforces it.
