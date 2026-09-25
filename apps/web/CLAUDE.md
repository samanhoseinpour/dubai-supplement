# apps/web — the storefront

Next.js 16 App Router on Cache Components, React 19, Tailwind 4, shadcn on
Base UI, Vazirmatn. Persian, RTL, two brand colours, three signal colours,
one light theme. Design system: `app/globals.css` plus `components/ui`; spec
`docs/superpowers/specs/2026-09-25-storefront-design-system-design.md`.

## Commands (from the repository root)

| Command                   | Does                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                | api on 3001, web on 3000                                          |
| `pnpm check`              | lint, typecheck, unit tests, **budget** (builds web)              |
| `pnpm build --filter=web` | must succeed with `API_INTERNAL_URL=http://127.0.0.1:9`           |
| `pnpm e2e`                | Playwright + axe against the production build                     |
| `pnpm e2e:install`        | Chromium, once per machine (VPN: `docs/runbooks/iran-mirrors.md`) |

`cp apps/web/.env.example apps/web/.env` once; never read `.env` back.

## Where things live

- `app/` — routes, `layout.tsx`, `globals.css` (the tokens), `fonts/`,
  `health/`, `robots.ts`, the three error files, `design/` (the gallery).
- `components/ui/` — the primitives: Button, Link, Surface, Badge, Skeleton,
  Price, EmptyState, TextField. `components/site/` — Header, Footer,
  Wordmark, Providers.
- `lib/` — `copy.ts` (every Persian string), `icons.ts` (semantic names),
  `errors.ts`, `motion.ts`, `env.ts` (`getServerEnv()`, lazy), `site.ts`,
  `utils.ts` (`cn`, taught the deleted scales).
- `test/` — tokens, lint regression, budget, env. `e2e/` — Playwright.

## Boundaries (lint-enforced)

`lib` → workspace packages only · `components/ui` → `lib` ·
`components/site` → `ui` + `lib` · `app` → anything · nothing → `app`.
`apps/web` never imports `apps/api`: no dependency is declared, pnpm's isolation
makes the import unresolvable, and a relative path into it fails lint.

## What fails `pnpm check` or `pnpm e2e`

- A class outside the tokens (`bg-blue-500`, `text-xl`, `bg-[#fff]`).
- A literal size, duration or variable colour — `w-[13px]`, `duration-300`,
  `bg-(--x)`.
- A physical inline-axis utility, even behind a variant (`md:ml-4`); the
  block axis and sizes (`mt-`, `top-`, `w-`, `h-`) never mirror and pass.
- `tracking-*`; `leading-none|tight`; `text-left|right|justify`; `z-<n>`; `dark:`.
- `export const dynamic | revalidate | fetchCache | runtime | dynamicParams`.
- `lucide-react` outside `lib/icons.ts`; `next/font/google` anywhere.
- A token whose text pair drops below 4.5:1, or `--input` below 3:1.
- A route whose own first-load JavaScript (beyond Next's shared root files)
  exceeds 100 KB gzipped, a framework floor over 140 KB, or a font over 120 KB.
- `pnpm e2e`: an axe violation at WCAG 2.2 AA on `/design`; a target under 44 × 44.

## What a reviewer checks

One primary action per view; one attention colour (the sale chip); ≤ 7 nav
items; spacing tiers (2–4 inside a component, 6–8 between groups, 12–16
between sections); Persian digits everywhere; no entrance animation; every
new primitive and state on `/design`.
