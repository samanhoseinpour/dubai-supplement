# 0021. A single light theme

- Status: accepted
- Date: 2026-09-25

## Context and Problem Statement

Phase 3a shipped two themes: light by default and dark on request, switched by `next-themes` through a `data-theme` attribute that a pre-paint script set before hydration, with a three-item toggle in the header — deliberately the first portal component — and a View Transitions cross-fade. The palette revision of [ADR-0020](0020-lapis-and-the-ink-as-primary.md) was first drafted for both themes, and the draft showed what the second one costs: every token, every gallery section and every axe run doubled; every route under the root layout carried a chunk of about 51 KB gzipped — Base UI's Menu with floating-ui, plus `next-themes` — for the toggle alone, more than half of the app's own first-load share (`/` 75.1 KB, `/design` 81.1 KB; the app share fell by 48.7 KB on `/` and 45.6 KB on `/design` when it left — Consequences); the root element needed `suppressHydrationWarning` and an inline script that a future content-security policy would have to nonce; and the tokens test, the gallery and every review had to hold two palettes in mind. On 2026-09-25, at the definition-of-done look at `/design`, Saman asked to drop the dark theme properly rather than hide it. The convention agrees: Iranian marketplaces ship one light theme, and Digikala's own guideline treats white as the primary colour and reserves black backgrounds for campaigns. The question is whether the storefront keeps a dark theme at all, and if not, how it leaves so that nothing half-removed lingers.

## Considered Options

1. **Light and dark, with a paper ink in dark** — the first revision of ADR-0020, previewed as palette A. It answers the too-blue paragraph and keeps everything else: the toggle, the attribute, the pre-paint script, the doubled tokens, tests and gallery, and the chunk on every route.
2. **Light only** — the tokens live on `:root`; `color-scheme: light` on `:root` and `viewport.colorScheme = 'light'` in the root layout tell the browser; the toggle, the provider, the attribute, the custom `dark:` variant, the cross-fade and the dependency are removed, and lint rejects `dark:` by name, because Tailwind's built-in variant would otherwise answer `prefers-color-scheme` on its own.
3. **Dark only** — the look of some foreign gym-supplement stores, but against every Iranian marketplace with a published value (a white page, 5 of 5) and against the light-first research recorded in ADR-0020.

## Decision Outcome

Chosen: **light only**, because it is what the shoppers' conventions expect and it halves what has to be right. The removal is complete rather than cosmetic: `apps/web/test/tokens.test.ts` asserts that `globals.css` names no `data-theme`, no `@custom-variant dark` and no `prefers-color-scheme`, and that `next-themes` is imported nowhere under `apps/web`; the lint suite asserts that `dark:bg-card` is rejected; the header test asserts there is no theme control; the gallery test asserts each section renders once, with no panel attribute; the theme e2e spec is deleted and axe runs once per Playwright project.

### Consequences

- Good: half the tokens, tests and axe runs — one palette to derive, one gallery panel to review.
- Good: every route sheds the toggle chunk. Measured by `test/budget.test.ts` on 2026-09-25, the app's own first-load share fell by 48.7 KB on `/` — from 75.1 KB to 26.4 KB (202.3 KB → 153.6 KB total) — and by 45.6 KB on `/design` — from 81.1 KB to 35.5 KB (208.3 KB → 162.7 KB).
- Good: no hydration caveat — `suppressHydrationWarning` and the pre-paint script are gone — and a simpler static shell with nothing inline to nonce.
- Bad: a user whose OS prefers dark gets the light page.
- Bad: the first portal proof — the toggle's Menu under `dir="rtl"`, which the theme e2e spec asserted — leaves with it; the first real menu in 3b/3c carries that proof.

**Reversed if** the brand asks for a dark theme or analytics show demand for one. The tokens test and the gallery are where a second theme returns: a second token block, a second panel, a second axe run.
