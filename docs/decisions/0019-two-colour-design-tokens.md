# 0019. Two-colour design tokens with enforced semantics

- Status: superseded by [0020](0020-lapis-and-the-ink-as-primary.md)
- Date: 2026-09-25

## Context and Problem Statement

The storefront needs its colour system before any product page exists, so every later slice inherits it instead of inventing one ([3a spec](../superpowers/specs/2026-09-25-storefront-design-system-design.md) D11). Saman chose two colours, Black Iris `#080813` and Frozen `#A0BDDB`; there is no designer and no Figma file, and the `/design` gallery is the source of truth. Tailwind ships a twenty-six-family palette and shadcn's initialiser writes an oklch neutral theme, and either lets a third colour reach a component without anyone deciding it should. The tokens must also meet WCAG 2.2 AA in both themes, and Frozen measures 1.95:1 on white, so it can be a surface but never an ink on a light page.

## Considered Options

- shadcn's default theme: oklch neutrals plus one primary, with Tailwind's palette left available.
- A full tint ramp (50–950) generated from each brand colour.
- Two colours with derived neutrals under shadcn's semantic names, Tailwind's palette and default scales deleted.

## Decision Outcome

Chosen: **two colours with derived neutrals under shadcn's semantic names**, because it is the only option where the palette is a fact rather than a convention. Every neutral is one colour mixed over the other, or over paper or white, at a recorded percentage; `apps/web/test/tokens.test.ts` re-derives each from the two primitives and fails when a committed hex drifts, then checks every text pair at ≥ 4.5:1 and the control boundary at ≥ 3:1 in both themes. `--color-*: initial` in `app/globals.css` deletes Tailwind's palette, so `bg-blue-500` is an unknown class and `eslint-plugin-better-tailwindcss` fails the build on it; the same deletion applies to the default type, radius, shadow, easing and weight scales. shadcn's semantic colour names are kept, so a generated component's colour classes resolve unchanged; its type, shadow, radius, z-index and motion classes are mapped to this system when the component is added, and lint rejects them until then. Light is the default; dark inverts the ink and keeps the primary fill. **Superseded 2026-09-25 by ADR-0020:** Frozen leaves the system and the primary is the ink; the mechanism — derived tokens under shadcn's names, the deleted palette, the tokens test — carries forward unchanged.

### Consequences

- Good: a third colour cannot appear by accident, and a contrast regression fails a unit test rather than an audit.
- Good: light and dark share one primary button, byte for byte, so the brand reads the same in both.
- Bad: `shadcn add` is never a paste: every added component is edited to the type, shadow, radius and z-index scales before it lints.
- Bad: a semantic colour beyond the destructive red (success, warning) needs a new ADR and new derivations, not a class.
- Bad: dark-mode body text is pure Frozen and may read too blue on some screens; the remedy is one token and one test run.

**Reversed if** a third brand colour becomes necessary, or a required state cannot reach 4.5:1 from the two colours.
