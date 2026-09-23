---
name: adr
description: Create a new architecture decision record from the template, picking the next free number.
disable-model-invocation: true
---

# Write an ADR

1. Find the next free number: `ls docs/decisions/ | grep -oE '^[0-9]{4}' | sort -n | tail -1`, then add one. **0001 is reserved** for the NestJS 12 spike outcome and stays absent until Phase 2 records it.
2. Copy `docs/decisions/0000-template.md` to `docs/decisions/NNNN-<kebab-title>.md`.
3. Fill all three MADR headings. `pnpm check:docs` fails if any is missing.
4. **Considered Options needs more than one real option.** A record with a single option is a note, not a decision — name what you rejected and why.
5. **Decision Outcome must state what would reverse it.** A decision with no reversal condition is an opinion.
6. Link it from `docs/architecture/north-star.md` if it changes an invariant, a dependency direction or a non-goal.
7. Run `pnpm check:docs`.
