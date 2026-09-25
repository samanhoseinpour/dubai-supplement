# Dubai Supplement — Storefront Foundation and Design System (Phase 3a)

|               |                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**      | 2026-09-25 (brainstormed 2026-09-24/25; every section approved in conversation before it was written down)                                                                                                                                                                                                                                                                                    |
| **Status**    | Approved by Saman Hoseinpour, 2026-09-25. Plan: [2026-09-25-storefront-design-system.md](../plans/2026-09-25-storefront-design-system.md). Amended 2026-09-25 by [ADR-0020](../../decisions/0020-lapis-and-the-ink-as-primary.md) — Lapis replaces Frozen, the ink is the primary, three signal colours — and [ADR-0021](../../decisions/0021-a-single-light-theme.md) — a single light theme |
| **Owner**     | Saman Hoseinpour (solo developer, working with Claude Code)                                                                                                                                                                                                                                                                                                                                   |
| **Parent**    | [Foundation Design](./2026-08-27-foundation-design.md). Its §7 (storefront) is binding; this spec fills what §7 leaves undefined and amends it only where §13 says so                                                                                                                                                                                                                         |
| **Inputs**    | The two-colour palette chosen by Saman from `dyslove.design`'s "New Color Combos"; a typeface comparison rendered in the browser on 2026-09-24; [the apple-design skill](../../../.claude/skills/apple-design/SKILL.md); Vazirmatn v33.003 sources; shadcn 4.21.0 CLI source; package-registry checks on 2026-09-24 (Appendix A); the shadcnblocks.com license page (§2, D15)                 |
| **Next step** | Execute the plan on `feat/web-foundation`; one rebase-merge PR; 3b built (`docs/superpowers/plans/2026-09-25-brand-slice.md`); then 3c                                                                                                                                                                                                                                                        |

## 1. Purpose and scope

Build `apps/web`'s **foundation** — the shell and the design system every later storefront slice inherits — before any product page exists. The deliverable is rendered and tested, not documented: tokens, theming, the typeface, a motion policy, a small set of primitives, a gallery route that shows every primitive in every state in the one light theme (amended 2026-09-25, ADR-0021), and the lint rules, tests and budgets that make the design system's rules **fail the build** when broken rather than ask a reviewer to notice.

**Phase 3 is split into three sub-phases**, one pull request each ([ADR-0018](../../decisions/0018-one-pr-per-phase.md) is unchanged — these are phases):

| Sub-phase | Contents                                                                                                                                                              | Depends on |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **3a**    | This spec: `apps/web` shell, design system, `/design` gallery, lint enforcement, Playwright + axe, the `e2e` CI job (web server only), rules docs, ADR-0019           | Phase 2    |
| 3b        | `catalog/brand.ts`, the Brand module, migration, seed, `@ds/api-client`, the `openapi` CI job (foundation §5.7, §8)                                                   | Phase 2    |
| 3c        | `/brands`, `/brands/[slug]`, `app/sitemap.ts`, `lib/catalog.ts`, the §7.5 rendering shape on real data; the `e2e` job gains the API server, the services and the seed | 3a and 3b  |

3a and 3b are independent and may be built in either order.

This spec contains no product feature. The reference slice's pages (foundation §7.8) are 3c.

## 2. Decisions already made (do not re-open without an ADR)

Numbering continues from the foundation spec's D1–D7.

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Consequence                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D8  | Phase 3 ships as sub-phases 3a / 3b / 3c, one PR each                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Three review packages a reviewer can hold; 3a and 3b are independent                                                                                                                                                                                              |
| D9  | **Two brand colours:** Black Iris `#080813` and Lapis `#1762B6`, one light theme, and three signal colours — `destructive` (which `sale` equals), `success`, `warning` — derived from OKLCH triples, never typed. Neutrals are derived from the two, never imported. **Amended 2026-09-25 (ADR-0020, ADR-0021):** the decision read "Black Iris and Frozen `#A0BDDB`; light is the default; dark inverts the ink, not the primary fill; one semantic red for errors" — Frozen is retired and the dark theme removed | The ink is the primary fill. Lapis is an ink at 5.82:1 on paper — the link, the focus ring, the label of the tonal secondary button — and never a fill under white text. Tailwind's default palette is deleted (§5.1) so a third colour cannot appear by accident |
| D10 | **Vazirmatn**, as foundation §7.2 already says. Estedad was rendered side by side and declined                                                                                                                                                                                                                                                                                                                                                                                                                      | 111,152 B, inside the 120 KB font budget. Estedad is 128,304 B (over budget) and would have amended §7.2, one lint message, `web.md` and one e2e assertion                                                                                                        |
| D11 | The design system is a **rendered foundation**, not a rules document                                                                                                                                                                                                                                                                                                                                                                                                                                                | `apps/web` is scaffolded in this phase; every rule is demonstrated on `/design` and most are enforced by lint or a test                                                                                                                                           |
| D12 | **Static shell first, enforced by tooling** (over "motion-rich from day one" and "minimal")                                                                                                                                                                                                                                                                                                                                                                                                                         | Server components by default; one light theme with no runtime switch (amended 2026-09-25, ADR-0021); motion in CSS from tokens; `motion` 13.x is the decided library but is **not installed** until the first gesture surface                                     |
| D13 | The design system lives in `apps/web/components/ui` behind a lint-enforced boundary (foundation §4.5: `packages/ui` waits for an admin app)                                                                                                                                                                                                                                                                                                                                                                         | Extracting `packages/ui` later is a directory move, not a redesign                                                                                                                                                                                                |
| D14 | `/design` ships in production, `noindex`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | No build flag to drift: the `e2e` job runs the production build and tests the same page production serves                                                                                                                                                         |
| D15 | **shadcnblocks.com is not used in this repository**, although Saman holds a Pro license                                                                                                                                                                                                                                                                                                                                                                                                                             | Its license lists "Publishing the Components or their derivatives in a public repository" as a restriction and this repository is public (D7). Usable only as a private visual reference when 3c lays out product pages                                           |
| D16 | Accessibility target is **WCAG 2.2 AA**                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Raises foundation §7.9's axe tags (WCAG 2.0 only) to include 2.1 and 2.2 — target size becomes automated                                                                                                                                                          |

## 3. Constraints inherited from the foundation spec

Binding and not restated here: §7.1 (Next.js 16.3.6+, React 19.3, Turbopack, `reactCompiler: true`, `cacheComponents: true`, `output: 'standalone'`, `outputFileTracingRoot` at the repo root, **hand-written — no `create-next-app`**, `tsconfig.json` extends `@ds/config-typescript/nextjs.json`, `lib/env.ts` with a lazy `getServerEnv()`, DoD 9's build against `API_INTERNAL_URL=http://127.0.0.1:9`); §7.2 (`<html lang="fa" dir="rtl">`, logical utilities only, shadcn 4.21 `init --rtl -b base`, Base UI primitives, `DirectionProvider`, Vazirmatn vendored at `apps/web/app/fonts/` and loaded with `next/font/local` as `--font-vazirmatn` → `--font-sans`, `ss01` and `tnum`, `letter-spacing: 0` on Persian, `next/font/google` banned); §7.3 (formatting on the server through `@ds/persian`); §7.6 (the three error files with Persian copy); §7.7 (`metadataBase`, `openGraph.locale: 'fa_IR'`, `app/robots.ts`); §7.9 (Vitest + Testing Library + jsdom; Playwright with `locale: 'fa-IR'`, `timezoneId: 'Asia/Tehran'`, one desktop and one mobile project; the budgets); §12.1 (`apps/web/CLAUDE.md` ≤ 60 lines); D3 / [ADR-0007](../../decisions/0007-persian-only-rtl.md) (Persian only, permanently — nothing here carries i18n weight); [north-star §4](../../architecture/north-star.md) (nothing fetched from a foreign host at request time); [ADR-0006](../../decisions/0006-cache-components.md) (the static shell, and the Next server as the only API caller).

Repository mechanics that shape every task: `catalogMode: strict` with `minimumReleaseAge: 1440`, so every new dependency is a catalog entry first and at least a day old; `envMode: strict`, so every variable a web task reads is declared in `turbo.json`; commitlint scope `web`; `scripts/check-docs.manifest` lists every config file this phase adds; `.env*` files are never read by an agent.

## 4. Architecture and file layout

### 4.1 Scaffold

`apps/web` is written by hand to §7.1. Then, once, `pnpm dlx shadcn@4.21.0 init --rtl -b base --pointer` (an _ask_ command, foundation §12.2). Verified against shadcn 4.21.0's `init.ts`: `--rtl` exists, `-b, --base <base>` exists with `base` as its default, and `--pointer` restores `cursor: pointer` on buttons — the e-commerce convention (§9, Jakob). The catalog is pre-seeded with everything the initializer installs **before** it runs, or `catalogMode: strict` refuses the install — the same trap Phase 2's Nest scaffold hit. After it runs, the generated oklch theme block is replaced by §5, and the generated components' `text-xs`/`text-sm`/`text-lg`, `rounded-*`, `shadow-*` and `ease-*` classes are remapped to §5–§6's scales — under §5.1's deletions those classes no longer exist, so one lint run after `init` lists every occurrence; `components.json` and `lib/utils.ts` (`cn`) stay. `tw-animate-css` is **not** installed: overlay motion comes from §7's own utilities, and its physically-named `slide-in-from-left-*` classes would fail §11's logical-properties rule anyway.

**Amended 2026-09-25 (plan, deviation 1):** the initializer is not run; `components.json` and `lib/utils.ts` are written by hand to the values it would produce, because 4.21's base item installs `shadcn` at runtime, `tw-animate-css` and a Google-font item.

### 4.2 Layout (no `src/`, matching foundation §4.1 and shadcn's defaults)

```
apps/web/
  app/
    layout.tsx            <html lang="fa" dir="rtl">, fonts, viewport colorScheme light, DirectionProvider, skip link, Header, Footer
    page.tsx              /
    globals.css           the design system's single source of truth (§5–§7)
    fonts/                Vazirmatn[wght].woff2 (vendored, 111,152 B)
    health/route.ts       GET → await connection() → 200 {"status":"ok"}
    robots.ts
    error.tsx · not-found.tsx · global-error.tsx
    design/page.tsx       the gallery (§10.3), plus design/sections/*.tsx
  components/
    ui/                   shadcn-managed primitives — the design system's public surface (§8)
    site/                 Header, Footer, Wordmark, Providers — composed from ui/
  lib/
    env.ts                getServerEnv() — lazy Zod (§7.1)
    utils.ts              cn()
    copy.ts               every Persian string, typed keys (§6.5)
    errors.ts             ErrorCode → Persian message (§8.3)
    icons.ts              semantic icon names over lucide-react (§8.2)
    motion.ts             spring parameters (§7.3)
  e2e/                    Playwright (§10.2)
  test/                   tokens.test.ts, budget.test.ts (§10.1)
  next.config.ts · postcss.config.mjs · eslint.config.js · tsconfig.json · vitest.config.ts · playwright.config.ts · components.json · .env.example · CLAUDE.md
```

### 4.3 Boundaries (the web half of foundation §4.3 rule 5)

`eslint-plugin-boundaries` elements: `app/**`, `components/site/**`, `components/ui/**`, `lib/**`.

| From              | May import              |
| ----------------- | ----------------------- |
| `lib`             | workspace packages only |
| `components/ui`   | `lib`                   |
| `components/site` | `components/ui`, `lib`  |
| `app`             | anything                |
| anything          | never `app`             |

This boundary **is** the design system. When an admin app exists, `components/ui` plus the token block move to `packages/ui` unchanged (D13).

### 4.4 Rendering

Cache Components static shell everywhere. `/`, `/design` and the error pages are fully static; `/health` is a route handler that awaits `connection()` (foundation §7.5); nothing in a layout or page reads `cookies()` or `headers()`. Server components by default. `'use client'` appears only in primitives that wrap a Base UI component, which Base UI requires, and in `error.tsx` and `global-error.tsx`, which Next.js requires to be client components (amended 2026-09-25; the theme provider and toggle this sentence once named left with ADR-0021). Surface, Badge, Skeleton, Price and EmptyState are server components.

### 4.5 `/design`

A real route, statically rendered, `robots: { index: false }` in its metadata. It is the acceptance surface (§10.3) and the source of truth for what the design system contains — a primitive or state that is not on `/design` does not exist.

### 4.6 Environment

Foundation Appendix B already inventories web's four variables (`NODE_ENV`, `PORT`, `API_INTERNAL_URL`, `NEXT_PUBLIC_SITE_URL`); this phase adds none. `apps/web/.env.example` carries the local values. `turbo.json` declares them per task (Appendix B).

## 5. Tokens and theming

`app/globals.css` is the single source of truth. Every value below is a token there; nothing in a component carries a literal colour, size or duration.

### 5.1 The rule that makes two brand colours a fact

```css
@import 'tailwindcss';

@theme {
  --color-*: initial; /* Tailwind's palette is gone: bg-blue-500 does not exist in this app */
  --text-*: initial; /* likewise text-xl — the scale in §6.2 is the only one */
  --radius-*: initial;
  --shadow-*: initial;
  --ease-*: initial;
  --animate-*: initial;
  --font-weight-*: initial; /* then exactly the five weights of §6.1, under Tailwind's names */

  --color-iris: #080813;
  --color-lapis: #1762b6;
  --font-sans: var(--font-vazirmatn), Tahoma, Arial, sans-serif;
  /* …§5.4, §6.2 and §7.2 scales… */
}
```

The semantic tokens use **shadcn's names**, so every component the CLI generates works without edits. **Amended 2026-09-25 (plan Task 12; reworded in the final review):** a semantic colour class (`bg-background`, `text-primary-foreground`) resolves unchanged, while a palette class (`bg-white`, `bg-black/10`) is deleted and fails `no-unknown-classes`; the type, shadow, radius, z-index and motion classes of a generated component are mapped to §5–§7's scales when it is added, because those default scales are deleted too. The semantic tokens are defined on `:root` — only there since 2026-09-25 (ADR-0021) — and exposed to utilities through `@theme inline` so that `bg-background`, `text-primary-foreground` and `border-input` compile to `var(--background)` etc.

**Text-carrying tokens are solid colours**, pre-mixed and committed as hex. Alpha is permitted only on tokens that never carry text (`--border`, `--input`, scrims, hover tints). That constraint is what lets §10.1's contrast test run on the source file without a browser.

Percentages below mean "the first colour mixed over the second in sRGB at that fraction" (`bg + (fg − bg) × p`). Ratios are WCAG 2.x, computed on 2026-09-25 by the script that becomes `test/tokens.test.ts`.

### 5.2 The palette (light, the only theme)

**Amended 2026-09-25 ([ADR-0020](../../decisions/0020-lapis-and-the-ink-as-primary.md), [ADR-0021](../../decisions/0021-a-single-light-theme.md)):** the primary is the ink. Frozen is retired and Lapis `#1762B6` is the second brand colour: an ink at 5.82:1 on paper, so it is the link, the focus ring, the label of the tonal secondary button and of its hover, and the selection highlight — and never a fill under white text. Three signal colours — `destructive` (which `sale` equals), `success` and `warning` — join it. Lapis and the signal inks follow one rule: hue per colour (red 28, green 150, amber 65, blue 255); lightness 0.50; chroma the largest hundredth at least 0.01 below the sRGB gamut boundary for that lightness and hue — the boundary being the largest chroma whose linear-light sRGB channels all stay within 0 to 1, found by bisection — capped at 0.18; which yields red 0.19, capped to 0.18, green 0.12, amber 0.10 and blue 0.15. The gamut-limited green and amber are why an AA amber ink is brown: at L 0.50 sRGB has no orange left. The CSS stays hex; `test/tokens.test.ts` computes the OKLCH and re-measures every pair below. This is the only theme (§5.6).

| Token                       | Value                    | Derivation                                                                | Measured                                                                                  |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `--background`              | `#FAFAFC`                | paper — white with a trace of Iris                                        | —                                                                                         |
| `--foreground`              | `#080813`                | Iris                                                                      | 19.10:1 on background                                                                     |
| `--card`                    | `#FFFFFF`                |                                                                           | 1.04:1 on background (separated by border and shadow, not fill)                           |
| `--card-foreground`         | `#080813`                | Iris                                                                      | 19.92:1 on card                                                                           |
| `--popover` / `-foreground` | = card / card-foreground |                                                                           |                                                                                           |
| `--primary`                 | `#080813`                | Iris — **the ink**                                                        | 19.10:1 on background; needs no edge                                                      |
| `--primary-foreground`      | `#FAFAFC`                | paper                                                                     | 19.10:1 on primary                                                                        |
| `--secondary`               | `#DFE8F4`                | Lapis 12% over paper — the tonal second button                            |                                                                                           |
| `--secondary-foreground`    | `#1762B6`                | Lapis                                                                     | 4.91:1 on secondary                                                                       |
| `--muted`                   | `#F0F0F3`                | Iris 4% over paper                                                        |                                                                                           |
| `--muted-foreground`        | `#64646C`                | Iris 62% over paper                                                       | 5.63:1 on background · 5.16:1 on muted · 5.86:1 on card                                   |
| `--accent`                  | `#D6E2F1`                | Lapis 16% over paper — hover and highlight surface; the secondary's hover |                                                                                           |
| `--accent-foreground`       | `#1762B6`                | Lapis                                                                     | 4.63:1 on accent                                                                          |
| `--destructive`             | `#B3241F`                | oklch(0.50 0.18 28)                                                       | 6.32:1 as text on background · 6.59:1 on card                                             |
| `--destructive-foreground`  | `#FAFAFC`                | paper                                                                     | 6.32:1 on destructive                                                                     |
| `--destructive-soft`        | `#F6E5E4`                | destructive 12% over card                                                 | 5.41:1 under destructive as text                                                          |
| `--sale`                    | `#B3241F`                | = destructive, on purpose                                                 | 6.32:1 as text on background                                                              |
| `--sale-foreground`         | `#FAFAFC`                | = destructive-foreground                                                  | 6.32:1 on sale                                                                            |
| `--success`                 | `#21763C`                | oklch(0.50 0.12 150)                                                      | 5.41:1 as text on background · 5.64:1 on card                                             |
| `--success-foreground`      | `#FAFAFC`                | paper                                                                     | 5.41:1 on success                                                                         |
| `--success-soft`            | `#E4EFE8`                | success 12% over card                                                     | 4.79:1 under success as text                                                              |
| `--warning`                 | `#8A5619`                | oklch(0.50 0.10 65) — brown, by the gamut                                 | 5.88:1 as text on background · 6.13:1 on card                                             |
| `--warning-foreground`      | `#FAFAFC`                | paper                                                                     | 5.88:1 on warning                                                                         |
| `--warning-soft`            | `#F1EBE3`                | warning 12% over card                                                     | 5.18:1 under warning as text                                                              |
| `--link`                    | `#1762B6`                | Lapis — a new token                                                       | 5.82:1 on background · 6.07:1 on card                                                     |
| `--border`                  | Iris at 12% alpha        | decorative separation                                                     | composites to `#DDDDE0`; 1.30:1 — not a control boundary                                  |
| `--input`                   | Iris at **48%** alpha    | **the control boundary**                                                  | composites to `#86868C`; **3.47:1** on background, 3.52:1 on card (WCAG 1.4.11)           |
| `--ring`                    | `#1762B6`                | Lapis                                                                     | 5.82:1 on background — the ring is drawn 2 px _outside_ the control, over the page (§7.2) |

The primary is the ink under a paper label, so it needs no edge. Lapis is an ink and a surface: the link, the focus ring, the label of the secondary button on its own 12 % tint, the 16 % accent tint the secondary and the ghost button hover to, and the selection highlight (`::selection` is the accent under the foreground, 15.18:1). `--sale` equals `--destructive` on purpose: red is the Iranian discount convention, and a view carries one red. Soft surfaces are the ink at 12 % over the card, for state badges and notices; solid fills are for attention.

shadcn's `--chart-*` and `--sidebar-*` tokens are not defined; nothing uses them.

### 5.3 Dark

**Removed 2026-09-25 ([ADR-0021](../../decisions/0021-a-single-light-theme.md)):** this section held the dark palette — Frozen as the dark ink, under a review point that a paragraph of it might read too blue. Saman judged it so on a real screen; Frozen left the system with ADR-0020 and the dark theme with ADR-0021. There is no `[data-theme='dark']` block, no `dark:` variant and no second gallery panel; the tokens above are the only ones.

### 5.4 Non-colour scales

| Scale     | Tokens                                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Radius    | `--radius-sm: 0.5rem` (8) · `--radius-md: 0.75rem` (12) · `--radius-lg: 1rem` (16) · `--radius-full: 9999px`                                                                                                                                                 |
| Elevation | `--shadow-sm` (a raised card at rest) · `--shadow-md` (a raised card on hover, a popover) · `--shadow-material` (floating chrome — deeper, because a bigger surface reads as thicker)                                                                        |
| Z-index   | `--z-header: 10` · `--z-overlay: 20` · `--z-sheet: 30` · `--z-toast: 40`, exposed as `@utility` classes `z-header` … `z-toast` (Tailwind 4 has no `--z-index-*` theme namespace — its `z-<n>` utilities are bare numbers, so they are banned by name in §11) |
| Spacing   | Tailwind's default 0.25 rem step, with documented tiers: **2–4** inside a component (label ↔ field ↔ hint), **6–8** between related groups, **12–16** between sections                                                                                       |
| Layout    | `--container-page: 75rem`; page gutter `1rem`, `1.5rem` from `md`; `--container-prose: 42rem` for running text; Tailwind's default breakpoints                                                                                                               |
| Motion    | §7.2                                                                                                                                                                                                                                                         |

### 5.5 The material

Floating chrome — the sticky header now, sheets later — is a translucent layer the content scrolls under (apple-design §12): `--background` at 72% opacity with `backdrop-filter: blur(20px) saturate(180%)` and `--shadow-material`. Under `prefers-reduced-transparency: reduce` it is solid `--background` with no blur. **Two translucent surfaces never stack.**

### 5.6 One theme (ADR-0021)

**Amended 2026-09-25 ([ADR-0021](../../decisions/0021-a-single-light-theme.md)):** the storefront ships one light theme. `color-scheme: light` sits on `:root` in `globals.css` and `viewport.colorScheme = 'light'` in the root layout, so native controls and scrollbars follow; there is no runtime switch, no stored preference, no pre-paint script, no `data-theme` attribute and no `suppressHydrationWarning`. A user whose OS prefers dark gets the light page. The shell stays static ([ADR-0006](../../decisions/0006-cache-components.md)) because nothing in a layout reads a cookie or a header — a theme preference was the one thing that would have needed one, and it no longer exists.

This section described `next-themes` 0.4.6 with `attribute="data-theme"`, `defaultTheme="light"`, `enableSystem`, a pre-paint script, a three-item toggle and a View Transitions cross-fade over `--duration-fade`; all of it was removed with the theme. `--duration-fade` stays for the Suspense cross-fade (§7.1).

## 6. Typography and Persian text

### 6.1 One family, five weights

Vazirmatn variable, vendored, loaded per foundation §7.2. Its Latin glyphs are built in (Roboto-derived), so a brand name inside a Persian sentence never falls back to another face. Weights and their only roles: **400** body · **500** labels, buttons, emphasis · **600** badges · **700** titles · **800** display and the wordmark. A variable font makes the extra weights free in bytes; the discipline is in the roles.

### 6.2 The scale

`--text-*` tokens with paired line-heights (`--text-body--line-height`), so `text-body` sets both and nobody composes size and leading by hand. Tailwind's `xs…9xl` are deleted (§5.1).

| Token      | Size                                                   | Leading  | Role                          |
| ---------- | ------------------------------------------------------ | -------- | ----------------------------- |
| `caption`  | 0.75 rem (12 px)                                       | 1.6      | fine print, timestamps        |
| `small`    | 0.875 rem (14 px)                                      | 1.7      | secondary text, table cells   |
| `body`     | 1 rem (16 px)                                          | **1.85** | paragraphs, inputs, buttons   |
| `lead`     | 1.125 rem (18 px)                                      | 1.75     | product meta, intros          |
| `title-sm` | 1.25 rem (20 px)                                       | 1.5      | card titles                   |
| `title`    | 1.5 rem (24 px)                                        | 1.45     | section titles, product names |
| `headline` | `clamp(1.75rem, 1.4rem + 1.5vw, 2.25rem)` (28 → 36 px) | 1.3      | page `h1`                     |
| `display`  | `clamp(2.25rem, 1.75rem + 2.5vw, 3.5rem)` (36 → 56 px) | 1.2      | hero, wordmark                |

Persian carries dots and tails above and below the line; body leading is 1.85, not Latin's 1.5. Inputs are never smaller than 16 px — iOS Safari zooms the viewport into anything smaller.

### 6.3 Rules lint enforces (§11)

`letter-spacing` is never set: `tracking-*` classes are banned, because connected letters tear apart under tracking. The apple-design tracking advice applies to Latin display type and is not used here. `leading-none` and `leading-tight` are banned outside the scale. `text-left`, `text-right` and `text-justify` are banned — everything is start-aligned; centring is reserved for empty states and the hero. Running text is capped at `--container-prose`.

### 6.4 Digits

Every customer-facing number is formatted **on the server** by `@ds/persian` — `formatToman`, `formatNumber`, `formatJalali` — which emit Persian codepoints (U+06F0–U+06F9), the Persian thousands separator `٬` and "تومان". Two safety nets sit underneath, both **verified in Vazirmatn v33.003's build scripts** (`scripts/farsi-digits.fea`, `scripts/tnum.fea`, merged by `make-fonts.sh` into the main font):

- `font-feature-settings: 'ss01'` on `html`: any ASCII or Arabic-Indic digit that reaches the page — a value the user typed, a browser-formatted number — still _renders_ as a Persian glyph.
- `font-variant-numeric: tabular-nums` on prices, quantities and tables: `tnum` is present and the build equalises Latin and Persian digit widths, so columns align across scripts.

A stray ASCII digit in customer-facing copy is a **test failure**, not a style choice (§10.1).

### 6.5 Copy

Every Persian string lives in `lib/copy.ts` with typed keys; components import the key, never the literal. The site name «دبی ساپلیمنت» is one constant (`SITE_NAME`) and a placeholder until a real mark exists; the title template is `%s | دبی ساپلیمنت`. Voice: formal _شما_; plain verbs; a call to action names what happens («افزودن به سبد خرید», never «ثبت»); an error says what went wrong and what to do next, without apologising; an empty state is an invitation to act. `lib/errors.ts` maps each of `@ds/contracts`' nine `ErrorCode`s to a Persian sentence with a generic fallback (foundation §7.6); English never reaches a customer.

## 7. Motion

The [apple-design skill](../../../.claude/skills/apple-design/SKILL.md) governs, translated to what a foundation with no gesture surface can honestly ship. Its direction-specific advice (a panel entering from the right, `swipeleft`) is mirrored for RTL when the surface that needs it arrives; its typography advice yields to §6 where they conflict.

### 7.1 Principles kept

- **Respond on pointer-down.** Buttons and pressable surfaces scale to `0.97` over `--duration-press` on `:active` — the skill's own numbers. `transform` and `opacity` only.
- **No entrance choreography.** Nothing fades and slides in on scroll or load; that is the most recognisable tell of a generated page. The one automatic motion is functional: a Suspense island's content cross-fades over its skeleton (opacity only, `--duration-fade`) instead of popping.
- **Hover exists only on hover devices** — `@media (hover: hover)` — so a phone never shows a stuck hover state.
- **Focus rings are instant.** 2 px `--ring`, 2 px `outline-offset`, never transitioned. The offset is functional, not cosmetic: it puts the ring over the page, where Lapis measures 5.82:1 on paper (amended 2026-09-25), rather than over a fill that could be its own colour.
- **Overlays materialise from their trigger.** Menus and popovers enter with opacity + scale from `0.96`, `transform-origin` at the trigger, over `--duration-quick` `--ease-out`; they exit along the same path with `--ease-in` (skill §7: symmetric paths, anchored origins).
- **Gesture-driven motion never uses CSS transitions** (skill §3). Nothing at foundation is gesture-driven, so nothing at foundation needs a JS spring.

### 7.2 Tokens

| Token               | Value                            | Used for                                                                                                                                         |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--duration-press`  | `100ms`                          | press feedback                                                                                                                                   |
| `--duration-quick`  | `150ms`                          | hover and focus colour, overlay enter/exit                                                                                                       |
| `--duration-fade`   | `200ms`                          | skeleton → content (the theme cross-fade it also timed left with ADR-0021)                                                                       |
| `--ease-out`        | `cubic-bezier(0.2, 0, 0, 1)`     | anything entering or responding                                                                                                                  |
| `--ease-in`         | `cubic-bezier(1, 0, 0.8, 1)`     | the mirror of `--ease-out`, for anything leaving                                                                                                 |
| `--animate-shimmer` | 1.6 s linear infinite (≈ 0.6 Hz) | skeletons — well clear of the ~0.2 Hz the skill warns about                                                                                      |
| `--animate-spin`    | 1 s linear infinite              | the loading button's spinner only — a small status indicator, not vestibular, so it is the one animation that keeps running under reduced motion |

### 7.3 Springs: parameters now, library later

`lib/motion.ts` exports the three springs from the skill in Motion's `bounce` / `duration` form, which maps to Apple's damping ratio / response:

```ts
export const SPRING = {
  default: { type: 'spring', bounce: 0, duration: 0.4 }, // damping 1.0, response 0.4 — no overshoot
  momentum: { type: 'spring', bounce: 0.2, duration: 0.4 }, // ≈ damping 0.8 — only after a flick or throw
  sheet: { type: 'spring', bounce: 0.2, duration: 0.3 }, // Apple's drawer/sheet values
} as const
```

`motion` 13.x is the decided library. It is loaded through `LazyMotion` with the `domAnimation` feature set and `m` components (≈ 20 KB, paid only by routes that render a gesture surface), and it is **installed by the first such surface** — the mobile navigation sheet, in a later slice. The skill's momentum projection (`decelerationRate 0.998`) and rubber-band (`constant 0.55`) formulas are recorded in `web.md` and implemented with that same surface; writing them now would be dead code with tests.

### 7.4 Preferences honoured everywhere

- `prefers-reduced-motion: reduce` — transforms off, cross-fades only, the shimmer becomes a static `--muted` block.
- `prefers-reduced-transparency: reduce` — the material (§5.5) goes solid.
- `prefers-contrast: more` — `--border` and `--input` become solid Iris; the ring thickens to 3 px.

## 8. Components

### 8.1 Inventory

Only what the shell, the gallery, the error pages and the certain next slices need. Every primitive appears on `/design` in every state, both viewports, in the one theme (amended 2026-09-25).

| Primitive      | Shape                                                                                                                                                                                                                                                                                                                                                                                                       | States                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**     | `primary` (the ink as a fill — Iris under paper, no edge; amended 2026-09-25) · `secondary` (the Lapis 12 % tint under a Lapis label, hovering to the 16 % accent tint) · `ghost` · `destructive` · `link` (the link ink); sizes `md` 44 px and `lg` 48 px min-height — nothing smaller exists, because §9's Fitts rule is ≥ 44 × 44; icon-only square at 44; `block` for full width on mobile              | hover tint (hover devices), focus ring, pressed scale, `disabled`, **loading** — the spinner takes the icon slot, the label stays, the width never changes, `aria-busy` |
| **Link**       | `--link` — Lapis, 5.82:1 on paper (amended 2026-09-25) — always underlined (1 px, `text-underline-offset: 3px`), distinguishable from text without colour; darkens to the foreground on hover                                                                                                                                                                                                               | hover, focus                                                                                                                                                            |
| **Surface**    | `default` (card + `--border`) · `raised` (`--shadow-sm`, `--shadow-md` on hover) · `material` (§5.5, floating chrome only) · `pressable` (a whole-card link with press feedback)                                                                                                                                                                                                                            | —                                                                                                                                                                       |
| **TextField**  | Base UI Field + Input: label above, start-aligned; optional hint; error text wired through `aria-describedby` and `aria-invalid`; `inputMode` prop; 48 px; 16 px text; `--input` edge                                                                                                                                                                                                                       | focus, error, disabled                                                                                                                                                  |
| **Badge**      | `inverted` (the Von Restorff chip) · `outline` · `sale` (solid, the discount chip) · `success` · `warning` · `destructive` (soft: the ink on its 12 % tint — state, not attention); `caption` size, weight 600 (amended 2026-09-25)                                                                                                                                                                         | —                                                                                                                                                                       |
| **Skeleton**   | block, text lines, circle; `aria-hidden`; `SkeletonText lines={n}` for Suspense fallbacks                                                                                                                                                                                                                                                                                                                   | shimmer; static under reduced motion                                                                                                                                    |
| **Price**      | server component: `amountMinor: bigint`, optional `original: bigint` → `formatToman`, `tabular-nums`, a struck original, a computed discount `Badge` of variant `sale` (truncated percentage in Persian digits; amended 2026-09-25). A raw number cannot reach the page through it. A discount whose truncated percentage is 0 renders as no discount — neither struck price nor badge (amended 2026-09-25) | —                                                                                                                                                                       |
| **EmptyState** | icon slot, title, one line, one action; centred                                                                                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                       |
| **Header**     | `material` Surface, sticky, `z-header`; Wordmark at start, one nav link («برندها» → `/brands`, a route 3c creates — until then it renders the not-found page, and nothing is deployed before Phase 4); the end slot is empty until 3c adds the cart (amended 2026-09-25: the ThemeToggle it held left with ADR-0021)                                                                                        | —                                                                                                                                                                       |
| **Footer**     | Wordmark, one line of copy, the year in Persian digits                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                                                                       |

**Removed 2026-09-25 (ADR-0021):** the ThemeToggle row — a Base UI Menu with three radio items «روشن / تاریک / سیستم», deliberately the first portal component — left with the theme; the first real menu in 3b/3c carries §7.2's `dir="rtl"`-on-portals proof.

Utilities defined with `@utility`: the `text-*` scale, `container-page`, `prose`, `material`, `press`, `focus-ring`.

**Not in 3a:** Dialog, Sheet, Select, Checkbox, Radio, Switch, Tabs, Toast, Tooltip, Table, Pagination, Carousel, a quantity stepper. Each arrives with the first slice that needs it via `shadcn add` (Base UI variant) and inherits the tokens — which is the point of doing tokens first.

### 8.2 Icons

`lucide-react` is importable only from `lib/icons.ts` (§11), which exports **semantic** names: `IconForward` is lucide's chevron-_left_, because forward is left here; `IconBack`, `IconExternal`, `IconClose`, `IconCheck`, `IconSpinner`, `IconAlert`, `IconEmpty` (the three theme icons left with ADR-0021, 2026-09-25). Direction is fixed (D3), so no `rtl:` flipping is scattered through components — the intent of §7.2's `rtl:` reservation is met at the import. Sizes 16 / 20 / 24; `aria-hidden` unless the icon is the only content of a labelled control.

### 8.3 Error pages

`error.tsx`, `not-found.tsx` and `global-error.tsx` per foundation §7.6, composed from EmptyState and Button, with copy from `lib/copy.ts` and codes mapped by `lib/errors.ts`. `not-found.tsx` sets `<meta name="robots" content="noindex">`.

**Known limit (2026-09-25):** Next 16 also emits a static `_global-error.html` — its own English "500: This page couldn’t load" — copied to `pages/500.html` because the app has no Pages Router; `next start` serves it only when an error escapes the page render entirely (App Router shell failures render our `global-error.tsx`). Overriding it means adding a Pages Router `pages/500.html`; deferred.

## 9. Accessibility and the UX laws as rules

**Target: WCAG 2.2 AA** (D16). Playwright's axe run uses `withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])` — foundation §7.9's two tags cover WCAG 2.0 only and contain no target-size rule. Zero violations on the whole gallery, both viewports (one theme since 2026-09-25). A skip link «پرش به محتوا» is first in the tab order; landmarks are `header`, `nav` (labelled), `main`, `footer`; one `h1` per page; every control is keyboard-operable with the visible ring; 200% text zoom loses nothing because every dimension is in rem.

Each law becomes a rule someone can check, and the table says who checks it:

| Law                      | Rule                                                                                                                                                                                                                                                          | Enforced by                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Fitts                    | Every interactive target ≥ 44 × 44 CSS px; adjacent targets ≥ 8 px apart; the primary CTA is `block` on mobile and last in its group, in the thumb zone                                                                                                       | Playwright bounding boxes (§10.2); review   |
| Hick                     | ≤ 7 items in any nav or menu; **exactly one primary action per view**; secondaries are quieter by variant, never by size                                                                                                                                      | review (`web.md`, reviewer checklist)       |
| Von Restorff             | One attention colour per view — the sale red. The primary is the ink, not an accent, so a card may carry the primary button and one sale chip; the inverted chip and the sale chip never share a card; soft state badges are not accents (amended 2026-09-25) | review                                      |
| Jakob                    | Iranian e-commerce conventions win over invention: wordmark top-start; account and cart top-end when they exist; «۲٬۸۵۰٬۰۰۰ تومان»; «افزودن به سبد خرید»; Jalali dates; `۰۹…` phones; `cursor: pointer` on buttons                                            | review                                      |
| Proximity                | Label ↔ field ↔ hint at tier 2–4; related controls at 6–8; sections at 12–16. Spacing encodes grouping; a divider is used only where spacing cannot                                                                                                           | review                                      |
| Doherty (< 400 ms)       | Feedback on pointer-down; a skeleton immediately; no artificial delays; INP ≤ 200 ms (foundation §7.9)                                                                                                                                                        | §7; budgets                                 |
| Postel                   | Inputs accept Persian, Arabic-Indic and ASCII digits and Arabic ي / ك, normalised on write (`@ds/persian`, already built); display is strict                                                                                                                  | `@ds/persian` tests; §10.1 digit test       |
| Miller                   | Long numbers grouped with `٬`; fact rows in groups of ≤ 7                                                                                                                                                                                                     | `@ds/persian`; review                       |
| Aesthetic-usability      | One radius scale, one shadow scale, one type scale, two brand colours and three signal colours — consistency is the polish                                                                                                                                    | §5.1 deletions + `no-unknown-classes` (§11) |
| Contrast (1.4.3, 1.4.11) | Text ≥ 4.5:1; control boundaries and the ring ≥ 3:1; one theme (amended 2026-09-25)                                                                                                                                                                           | `test/tokens.test.ts` (§10.1)               |

## 10. Verification

### 10.1 Unit (`web#test`, Vitest + jsdom + Testing Library; needs nothing running)

- **`test/tokens.test.ts`** parses `app/globals.css`, re-derives every neutral and tint from `--color-iris`, `--color-lapis`, `#FAFAFC` and `#FFFFFF` at the percentages in §5.2, Lapis and every signal ink from its OKLCH triple (`oklchToHex`) and every `-soft` surface from its ink at 12 % over the card, and fails if a committed hex has drifted; then asserts every text pair in §5.2 ≥ 4.5:1, `--input` (composited over `--background` and `--card`) and `--ring` ≥ 3:1, that the primary is the foreground, that Lapis is only ever an ink, a ring or a link, and that `sale` equals `destructive`; and that the CSS names no `data-theme`, no `dark` variant and no `prefers-color-scheme`, and nothing under `apps/web` names `next-themes` (amended 2026-09-25). A token added without a pair fails.
- **Components:** Button renders each variant and size; the loading state keeps the label, sets `aria-busy`, and renders the spinner in the icon slot. TextField wires `aria-describedby` to hint and error and sets `aria-invalid`. **Price never emits an ASCII digit** (`expect(html).not.toMatch(/[0-9]/)`), shows «تومان», strikes the original, and truncates the discount percentage. `icons.ts`: `IconForward` renders lucide's chevron-left path. Every value in `copy.ts` contains no Latin letters or ASCII digits except an allow-listed brand token. `lib/errors.ts` maps all nine codes and has a fallback.
- **`lib/env.ts`:** the schema rejects a missing `API_INTERNAL_URL` at call time, and importing the module reads nothing from `process.env` (asserted with a `Proxy` that throws on access).

### 10.2 End to end (`web#e2e`, Playwright per foundation §7.9; in 3a `webServer` starts only `pnpm --filter web start`)

- `/`: `html[dir="rtl"][lang="fa"]`; `document.fonts` reports a loaded family matching `/vazirmatn/i`; the four landmarks; the skip link moves focus to `main` (the theme cases this line listed left with ADR-0021, 2026-09-25).
- `/design`: axe with the §9 tags on the whole page, once per Playwright project; every `[data-target]` element's bounding box ≥ 44 × 44; computed styles — the primary button's `background-color` is `rgb(8, 8, 19)` and the secondary's `rgb(223, 232, 244)`, the skeleton's `rgb(240, 240, 243)`, the `border` edge Iris at 12 % alpha (amended 2026-09-25), body `letter-spacing` is `normal`, `font-feature-settings` includes `"ss01"`, every input's `font-size` ≥ 16 px; under `emulateMedia({ reducedMotion: 'reduce' })` the skeleton has no running animation and the pressed button no transition.
- `/health` → 200 `{"status":"ok"}`; `/no-such-page` → the Persian not-found heading and `meta[name="robots"][content*="noindex"]`; `/robots.txt` is served.

Pixel snapshots are deliberately absent: baselines rendered on macOS fail on Linux runners because fonts rasterise differently, and doing it right means generating baselines inside the Playwright Docker image. Recorded as a follow-up in §15; the computed-style and axe assertions above are deterministic.

### 10.3 The gallery and the human gate

`/design` renders, per primitive, every variant × size × state, in one panel (amended 2026-09-25: the dark panel left with ADR-0021), at the mobile and desktop breakpoints, without interaction. It is the review artefact: **Saman reviews it on a phone and a laptop in the light theme**, and his approval is a DoD item (§14). "Premium" is his judgement to make; the gallery exists so that judgement takes minutes.

### 10.4 Budgets (`web#budget`, `dependsOn: ["build"]`, part of `pnpm check`)

`test/budget.test.ts` reads the production build's app manifest, gzips each route's chunk set and fails if any route's first-load JavaScript exceeds **130 KB** compressed, or the vendored font exceeds **120 KB**. Foundation §7.9's "enforced later" is enforced now. LCP and INP remain documented targets; a Lighthouse CI run on shared runners is too noisy to gate on and is out of scope (§15).

**Amended 2026-09-25 (plan Task 10):** the 130 KB total is unmeetable on Next 16.3.6, because its shared root files, loaded by every route, gzip to 127.2 KB on their own (measured 2026-09-25). The gate is now the app's own first-load share — the client chunks of every segment a route renders, beyond those root files — at **≤ 100 KB** gzipped per route; the root files are held to **≤ 140 KB** as a floor guard for framework upgrades; the font stays ≤ 120 KB; each route's total is reported, not gated. Baseline at 3a: `/design` 81.1 KB app of 208.3 KB total; `/` 75.1 KB app of 202.3 KB, of which about 51 KB on every route was the theme toggle's chunk. **Amended 2026-09-25 (ADR-0021):** with the toggle gone the baseline is `/` 26.4 KB app of 153.6 KB total and `/design` 35.5 KB app of 162.7 KB, measured by `test/budget.test.ts`; the first real menu pays for Base UI's Menu machinery only on the routes that render it.

## 11. Tooling and lint enforcement

`@ds/config-eslint/next` is rebuilt as three layers on the existing strict TypeScript base:

1. **`eslint-config-next` 16.3.6** — its `./core-web-vitals` flat config (react, react-hooks, jsx-a11y, `@next/next`). Pinned since Phase 1; wired now.
2. **`eslint-plugin-better-tailwindcss` 4.7.0**, `settings['better-tailwindcss'].entryPoint = apps/web/app/globals.css`, with:
   - `enforce-logical-properties` — replaces the Phase 1 regex, which missed variant-prefixed classes (`md:ml-4`), `float-*`, bare `border-l` and `rounded-tl-*`, and flagged any string containing `left-`. The cases in `scripts/test-rtl-rule.sh` become this rule's regression suite, with the variant case added; `packages/config-eslint/rtl.js` is removed. **Amended 2026-09-25 (plan Task 4):** the rule is scoped to the inline axis — block-axis and dimension utilities (`mt-`, `top-`, `w-`, `h-`, `border-t`, `rounded-t`, `space-y`) are ignored, because they never mirror between LTR and RTL; every left/right class stays enforced.
   - `no-unknown-classes` — with §5.1's deletions this catches `bg-blue-500`, `text-xl`, `shadow-lg`, `rounded-xl`, `ease-in-out`, `font-light`: anything the theme does not define.
   - `no-restricted-classes` — arbitrary colour values (`/\[(#|rgb|hsl|oklch)/`), `tracking-*`, `leading-none`, `leading-tight`, `text-left`, `text-right`, `text-justify`, `float-*`, and numeric `z-<n>` (bare-number utilities that no theme deletion can remove — §5.4). **Amended 2026-09-25 (final review):** also literal durations and delays (anything but `duration-(--duration-*)` and `delay-(--duration-*)`); arbitrary easing, animation, size, leading, radius, shadow, weight and z values (`ease-[…]`, `text-[13px]`, `rounded-(--x)`, `font-[550]`, `z-[5]`); literal lengths anywhere (`w-[13px]`, `m-[1px_2px]`); variable and keyword colours (`bg-(--x)`, `bg-[var(--x)]`, `text-[red]`); and the important modifier in either position (`md:!text-left`, `leading-none!`) — so a literal colour, size or duration fails lint, as the rules files have said since Task 12. **Amended 2026-09-25 (ADR-0021):** also the `dark:` variant, by name — Tailwind's built-in `dark` is a `prefers-color-scheme` query, so deleting the custom variant alone would not make it unknown.
   - `no-conflicting-classes`, `no-duplicate-classes`.
     Class **order** is Prettier's job — `prettier-plugin-tailwindcss` 0.8.1 is finally enabled with `tailwindStylesheet: './apps/web/app/globals.css'`, closing the Phase 1 deferral — so the two tools never fight.
3. **Project rules:** `no-restricted-syntax` selectors that ban `export const dynamic | revalidate | fetchCache | runtime | dynamicParams` under `app/**`, which makes `web.md`'s and ADR-0006's "banned by lint" true for the first time; `no-restricted-imports` keeps the `next/font/google` ban and adds `lucide-react` outside `lib/icons.ts` and — amended 2026-09-25 (final review) — any relative path into `apps/api` (`../../api/src/…`), which pnpm's isolation alone leaves resolvable; the `eslint-plugin-boundaries` elements of §4.3.

Flat-config note carried from Phase 2: a later object that sets `no-restricted-syntax` or `no-restricted-imports` **replaces** the earlier options. Every selector and path for web lives in one object.

`apps/web/eslint.config.js` imports the config and adds only ignores and path anchors — an absolute `better-tailwindcss.entryPoint` and `cwd`, `boundaries/root-path`, `next.rootDir` — so the rules fire the same way from any working directory (amended 2026-09-25: ESLint 10 finds the config from the linted file but resolves relative settings against its cwd). Lint runs as `eslint .`, never `next lint` (foundation §12.1).

## 12. CI

- **New job `e2e`:** no service containers in 3a; `pnpm install --frozen-lockfile`; `cp apps/web/.env.example apps/web/.env`; Chromium installed with `--with-deps` and cached on the Playwright version; `pnpm turbo run build --filter=web` with `NEXT_PUBLIC_SITE_URL=http://localhost:3000` and `API_INTERNAL_URL=http://127.0.0.1:9`; `pnpm e2e`; the HTML report uploaded on failure. Same `concurrency` group as the other jobs. It is promoted to a required check after its first green run, in the [ADR-0013](../../decisions/0013-public-repository.md) sequence. 3c adds Postgres and Redis services, the API server and the seed.
- **`check`:** `pnpm check:affected` now includes web's `lint`, `typecheck`, `test` and `budget`; because `budget` depends on `build`, the job builds web — the existing DoD 9 step (an unreachable `API_INTERNAL_URL`) stays as the acceptance of that build.
- **Renovate:** `eslint-plugin-better-tailwindcss` joins the existing groups per the plan (`next-themes` did too, until its removal on 2026-09-25, ADR-0021).

## 13. Documentation deliverables and amendments

Written in this phase:

- This spec.
- **ADR-0019 — Two-colour design tokens with enforced semantics.** Considered: shadcn's default palette (oklch neutrals plus one primary); a full tint ramp per brand colour; two colours with derived neutrals and shadcn's semantic names (chosen). Reversed if a third brand colour becomes necessary, or a required state cannot reach 4.5:1 from the two.
- `.claude/rules/web.md` extended: tokens only, no literal colours, no default palette; the type scale and the no-tracking rule; the digit policy; the motion tokens, no entrance choreography, springs through `lib/motion.ts`, the recorded projection and rubber-band formulas; ≥ 44 px targets; one primary action per view; icons through `lib/icons.ts`; copy through `lib/copy.ts`; "a primitive or state not on `/design` does not exist".
- `apps/web/CLAUDE.md`, ≤ 60 lines.
- `.claude/agents/reviewer.md`: the review-enforced rows of §9's table join its checklist.
- `README.md`'s stack row: the design system — two brand colours, three signal colours, a single light theme (amended 2026-09-25).
- `scripts/check-docs.manifest`: the new web config files and `apps/web/CLAUDE.md` added; `packages/config-eslint/rtl.js` removed with the file (§11).
- `CLAUDE.md`: the `pnpm dev` row ("web arrives in Phase 3") now names web on 3000, and "squash-merged" becomes "rebase-merged" — ADR-0018 and Phase 2's pull request both rebase-merge; the line was never updated.
- **Amended 2026-09-25:** ADR-0020 (Black Iris and Lapis; the ink is the primary; signal colours derived — supersedes ADR-0019) and ADR-0021 (a single light theme).

Amendments to the [foundation spec](./2026-08-27-foundation-design.md), each dated 2026-09-25 and pointing here:

- **§7.8:** the foundation UI gains `/design` (and, until ADR-0021 removed it on 2026-09-25, the theme toggle); "That is the entire UI at foundation" now reads across 3a + 3c.
- **§7.9:** the axe tag list becomes the §9 list.
- **§7.2:** `tw-animate-css` is not installed (§4.1).
- **§4.3 rule 4** and **[north-star](../../architecture/north-star.md) §2 rule 3:** `apps/web` uses `@ds/contracts`, `@ds/api-client` **and `@ds/persian`** — §7.3 already said so; the two rules are brought into line.
- **§13.1:** Phase 3 is three sub-phases (D8).
- **Status row:** stale since Phase 2 merged.

## 14. Definition of done (3a)

1. `pnpm dev` brings up web on 3000; `/` renders the shell right-to-left in Vazirmatn, in the one light theme (amended 2026-09-25: the toggle and its reload check left with ADR-0021).
2. `/design` shows every primitive in every state in the light theme at both breakpoints, and **Saman has reviewed it on a phone and a laptop and approved it.**
3. `pnpm check` is green and now includes web's `lint`, `typecheck`, `test` and `budget`.
4. `pnpm e2e` is green locally; the `e2e` job is green on the pull request.
5. `pnpm --filter web build` succeeds with `API_INTERNAL_URL=http://127.0.0.1:9`.
6. Lint fails — each proven by the regression suite — on: a physical utility, including one behind a variant prefix; an unknown class (`bg-blue-500`); an arbitrary colour; a literal size or duration; a variable colour; `tracking-*`; a route segment config export; `lucide-react` imported outside `lib/icons.ts`; a relative import into `apps/api` (the size, duration, variable-colour and `apps/api` cases added 2026-09-25).
7. `test/tokens.test.ts` fails when a semantic hex is moved by one step or a pair drops below its threshold — proven once by mutation and recorded in the task report.
8. Every interactive element on `/design` is ≥ 44 × 44; axe reports zero violations at the §9 tags; the font is ≤ 120 KB; every route's app share is ≤ 100 KB gzipped and the framework floor ≤ 140 KB (amended 2026-09-25).
9. §13's documents exist; `pnpm check:docs` passes; `apps/web/CLAUDE.md` is ≤ 60 lines.
10. `pnpm audit:authors` passes; one rebase-merge PR, `feat/web-foundation` → `main`.

## 15. Out of scope (each with its owner)

3b and 3c's contents (§1). Installing `motion`, and every gesture surface — the mobile navigation sheet, a carousel, a quantity stepper (the first of them). Pixel snapshots (follow-up: baselines generated in the Playwright Docker image). Lighthouse CI. Identity, `requestApi()` and the `X-Forwarded-For` precondition (the identity spec — foundation §7.4). Images, `<SiteImage>`, a real logo and favicon set (the media spec). `proxy.ts` and CSP headers (since ADR-0021 there is no inline theme script to nonce). The admin app and any `packages/ui` extraction. `Dockerfile.web` and Liara (Phase 4; `output: 'standalone'` is configured now per §7.1). A second language (D3: never).

## 16. Risks and mitigations

| Risk                                                                                                                        | Mitigation                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tailwind 4.3's browser floor (Safari 16.4+, Chrome 111+) against Iran's older-device mix: layouts break rather than degrade | Accepted at foundation; measured once analytics exist (out of scope); the floor is recorded in `web.md` so nobody lowers it by accident                                                                                           |
| `next-themes` under React 19.3 / Next 16 hydration                                                                          | `suppressHydrationWarning` on `<html>` per its documentation; verified by the theme e2e cases the first time the layout exists — resolved by removal 2026-09-25 (ADR-0021): the dependency, the script and the attribute are gone |
| Base UI 1.8 components under `reactCompiler: true`                                                                          | Verified when the first Base UI primitive is added; a file can opt out with `'use no memo'` if the compiler mis-handles a render prop                                                                                             |
| shadcn's generated files diverge from this spec (oklch theme, animation classes)                                            | A reconciliation step in the plan, run once after `init`, with a test that `globals.css` contains no `oklch(`                                                                                                                     |
| `budget` builds web inside `pnpm check`, adding roughly a minute                                                            | Accepted; it is the only way the budget is a gate rather than a note                                                                                                                                                              |
| Playwright's Chromium download from Iran                                                                                    | The VPN note in `docs/runbooks/iran-mirrors.md` already covers `pnpm e2e`; CI runners are unaffected                                                                                                                              |
| Dark-mode body text in pure Frozen reads too blue                                                                           | One token (§5.3); decided on `/design` — materialised 2026-09-25: Frozen left the system (ADR-0020) and the dark theme with it (ADR-0021)                                                                                         |
| The View Transitions API is absent in older Safari                                                                          | The switch is instant there; nothing depends on the transition — moot since ADR-0021: nothing uses the API                                                                                                                        |

## Appendix A — Version pins added by this phase (verified on npm, 2026-09-24)

| Package                                                                                                                                     | Pin                                                                                                                                                                                                                                                                                     | Note                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `next-themes`                                                                                                                               | 0.4.6                                                                                                                                                                                                                                                                                   | 2025-03-11 — removed 2026-09-25 (ADR-0021)                |
| `eslint-plugin-better-tailwindcss`                                                                                                          | 4.7.0                                                                                                                                                                                                                                                                                   | 2026-07-19; rule names verified against its `docs/rules/` |
| `@types/react`                                                                                                                              | 19.3.0                                                                                                                                                                                                                                                                                  |                                                           |
| `@tailwindcss/postcss`                                                                                                                      | 4.3.3                                                                                                                                                                                                                                                                                   | matches `tailwindcss` 4.3.3                               |
| `@testing-library/react`                                                                                                                    | 16.3.3                                                                                                                                                                                                                                                                                  |                                                           |
| `jsdom`                                                                                                                                     | 30.1.1                                                                                                                                                                                                                                                                                  | needs Node ≥ 24.15 — `.node-version` is 24.21.0           |
| `server-only`                                                                                                                               | 0.0.1                                                                                                                                                                                                                                                                                   |                                                           |
| `class-variance-authority`                                                                                                                  | 0.7.1                                                                                                                                                                                                                                                                                   |                                                           |
| `@next/playwright`                                                                                                                          | 16.3.6                                                                                                                                                                                                                                                                                  | exists; pinned with `next`                                |
| `@types/react-dom`, `postcss`, `clsx`, `tailwind-merge`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@vitejs/plugin-react` | resolved at install, then pinned                                                                                                                                                                                                                                                        | at least 24 h old under `minimumReleaseAge`               |
| `shadcn`                                                                                                                                    | 4.21.0 via `pnpm dlx`                                                                                                                                                                                                                                                                   | not a catalog entry                                       |
| Already pinned in Phase 1                                                                                                                   | `next` 16.3.6 · `react`/`react-dom` 19.3.0 · `tailwindcss` 4.3.3 · `@base-ui/react` 1.8.0 · `lucide-react` 1.34.0 · `@playwright/test` 1.63.0 · `@axe-core/playwright` 4.13.0 · `eslint-config-next` 16.3.6 · `babel-plugin-react-compiler` 1.0.0 · `prettier-plugin-tailwindcss` 0.8.1 |                                                           |
| **Not installed**                                                                                                                           | `motion` (13.4.3 on 2026-09-24) · `tw-animate-css` · `shadcnblocks`                                                                                                                                                                                                                     | D12, §4.1, D15                                            |

## Appendix B — Environment variables (web; every key declared in `turbo.json`)

| Task         | Declared                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `web#build`  | `NEXT_PUBLIC_SITE_URL` (build-time), `API_INTERNAL_URL` (must be present, never fetched — DoD 9)              |
| `web#test`   | `NODE_ENV`                                                                                                    |
| `web#budget` | none beyond `build`'s                                                                                         |
| `web#e2e`    | `NODE_ENV`, `PORT`, `API_INTERNAL_URL`, `NEXT_PUBLIC_SITE_URL`; `CI` passed through for `reuseExistingServer` |

Local values (`apps/web/.env.example`): `NODE_ENV=development`, `PORT=3000`, `API_INTERNAL_URL=http://localhost:3001`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

## Appendix C — What this spec verified rather than assumed

| Claim                                                                     | How                                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Every ratio in §5.2–§5.3                                                  | Computed (WCAG 2.x relative luminance) from the hex values; the same code becomes `test/tokens.test.ts`       |
| Vazirmatn has `ss01` (ASCII and Arabic-Indic digits → Persian) and `tnum` | `scripts/farsi-digits.fea`, `scripts/tnum.fea` and `scripts/make-fonts.sh` in `rastikerdar/vazirmatn` v33.003 |
| `Vazirmatn[wght].woff2` is 111,152 B; Estedad's is 128,304 B              | Git tree blob sizes; jsDelivr `HEAD` responses                                                                |
| shadcn 4.21.0 `init` accepts `--rtl`, `-b base` (default) and `--pointer` | `packages/shadcn/src/commands/init.ts` at `shadcn-ui/ui`                                                      |
| The lint rules named in §11 exist                                         | `docs/rules/` in `schoero/eslint-plugin-better-tailwindcss` 4.7.0                                             |
| `eslint-config-next` 16.3.6 exports `./core-web-vitals`                   | Its published `exports` map                                                                                   |
| shadcnblocks.com's license forbids public repositories                    | Its license page, "Examples of restrictions", read 2026-09-25                                                 |
| The Phase 1 RTL regex misses variant-prefixed classes                     | Run against sample strings during exploration                                                                 |
