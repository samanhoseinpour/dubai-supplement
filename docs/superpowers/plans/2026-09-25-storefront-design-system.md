# Dubai Supplement — Storefront Foundation and Design System (Phase 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `apps/web` and ship the design system every later storefront slice inherits — two-colour tokens with proven contrast, light/dark theming on a static shell, Vazirmatn, a motion policy, nine primitives, the `/design` gallery, and the lint rules, unit tests, budgets and Playwright + axe checks that make the rules fail the build instead of a review.

**Architecture:** Server components by default on Cache Components; the theme is applied by `next-themes`' pre-paint script so no layout reads request state. `app/globals.css` is the single source of truth: Tailwind's default palette and scales are deleted with `--*: initial`, the two colours and derived neutrals are exposed under shadcn's semantic names, and every rule about them is enforced by `eslint-plugin-better-tailwindcss`, `eslint-plugin-boundaries`, a token-contrast unit test, a gzip budget test and axe at WCAG 2.2 AA. The design system lives in `apps/web/components/ui` behind a lint-enforced boundary.

**Tech Stack:** Next.js 16.3.6 (Turbopack, React Compiler, `cacheComponents`, `output: 'standalone'`) · React 19.3 · Tailwind CSS 4.3.3 · `@base-ui/react` 1.8.0 · `next-themes` 0.4.6 · `class-variance-authority` 0.7.1 · `clsx` 2.1.1 + `tailwind-merge` 3.7.0 · `lucide-react` 1.34.0 · Vazirmatn v33.003 (vendored) · Vitest 5.0.1 + jsdom 30.1.1 + Testing Library · Playwright 1.63.0 + `@axe-core/playwright` 4.13.0 · `eslint-config-next` 16.3.6 · `eslint-plugin-better-tailwindcss` 4.7.0 · `eslint-plugin-boundaries` 7.2.0 · `prettier-plugin-tailwindcss` 0.8.1

**Spec:** `docs/superpowers/specs/2026-09-25-storefront-design-system-design.md` (approved by Saman 2026-09-25). Its parent, `docs/superpowers/specs/2026-08-27-foundation-design.md` §7, is binding. Read both alongside this plan — every task argues from a numbered section.

**Starting state:** branch `feat/web-foundation` at `871df8b` (= `main` `649ad42` + the apple-design skill + the spec). `apps/api`, `@ds/persian` and `@ds/contracts` are merged and green. `apps/web` does not exist. `packages/config-eslint/next.js` exists but has never been consumed. The catalog already pins `next`, `react`, `react-dom`, `babel-plugin-react-compiler`, `tailwindcss`, `@base-ui/react`, `lucide-react`, `@playwright/test`, `@axe-core/playwright`, `eslint-config-next`, `prettier-plugin-tailwindcss`, `vitest`, `vite`, `zod`, `@types/node`.

## Global Constraints

Copied from the spec and its parent. Every task's requirements implicitly include this section.

- **Human-only authorship.** Every commit is authored by Saman Hoseinpour. No `Co-Authored-By`, no "Generated with", no bot attribution. Enforced by `scripts/check-commit-msg.sh` and `audit:authors`. (foundation §13.4)
- **Never read an env file.** `.env`, `.env.local`, `.env.*.local` are Read-denied. `apps/web/.env.example` is the only env file this plan writes. (`.claude/rules/security.md`)
- **Exact pins only, in the catalog.** `catalogMode: strict` + `minimumReleaseAge: 1440`: every new dependency is a catalog entry first and at least a day old. Every version in this plan was checked against the registry on 2026-09-25. Never run `sherif -f`. (spec §3)
- **`envMode: strict`.** Every variable a web task reads is declared in `turbo.json` (spec Appendix B). Web's variables are exactly `NODE_ENV`, `PORT`, `API_INTERNAL_URL`, `NEXT_PUBLIC_SITE_URL`; this phase adds none. (spec §4.6)
- **Next.js 16.3.6 is the security floor.** `reactCompiler: true`, `cacheComponents: true`, `output: 'standalone'`, `outputFileTracingRoot` at the repo root, **hand-written, no `create-next-app`**. `lib/env.ts` parses `process.env` inside `getServerEnv()`, never at module scope. The build must succeed with `API_INTERNAL_URL=http://127.0.0.1:9`. (foundation §7.1, DoD 9)
- **`<html lang="fa" dir="rtl">` unconditionally.** Persian only, permanently — no i18n provisions. (foundation §7.2, D3 / ADR-0007)
- **Logical Tailwind utilities only.** `ms- me- ps- pe- start- end- text-start`; physical classes fail lint, including behind a variant prefix. `rtl:` mirrors directional icons only. (foundation §7.2, spec §11)
- **Two colours.** Black Iris `#080813` and Frozen `#A0BDDB`; neutrals derived from them; one semantic red. Tailwind's default palette and its `text-*`, `radius-*`, `shadow-*`, `ease-*`, `animate-*`, `font-weight-*` scales are deleted. Nothing in a component carries a literal colour, size or duration. Frozen is a surface, never an ink on a light page. (spec D9, §5.1)
- **Text-carrying tokens are solid hex.** Alpha only on `--border`, `--input`, scrims and hover tints. Text ≥ 4.5:1, control boundaries ≥ 3:1, both themes, proven by `test/tokens.test.ts`. (spec §5.1, §9)
- **Light is the default theme.** `next-themes` with `attribute="data-theme"`, `defaultTheme="light"`, `enableSystem`, `enableColorScheme`, `storageKey="ds-theme"`; no `cookies()` or `headers()` in any layout or page. (spec §5.6, ADR-0006)
- **Vazirmatn only**, vendored at `apps/web/app/fonts/`, `next/font/local`, `--font-vazirmatn` → `--font-sans`; `next/font/google` is banned by lint; `letter-spacing` is never set; inputs are never smaller than 16 px. (foundation §7.2, spec §6)
- **Digits are formatted on the server by `@ds/persian`.** A stray ASCII digit in customer-facing copy is a test failure. Every Persian string lives in `lib/copy.ts`. (spec §6.4, §6.5)
- **Motion is CSS from tokens.** `motion` is decided but **not installed**; no entrance choreography; hover only on hover devices; focus rings instant; `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast: more` honoured. (spec D12, §7)
- **Every interactive target ≥ 44 × 44 CSS px; exactly one primary action per view; ≤ 7 items in any nav or menu.** (spec §9)
- **`/design` ships in production, `noindex`.** A primitive or state not on `/design` does not exist. (spec D14, §4.5)
- **No route segment configs** (`export const dynamic | revalidate | fetchCache | runtime | dynamicParams`), banned by lint under `app/**`. (ADR-0006, spec §11)
- **Boundaries:** `lib` → workspace packages only; `components/ui` → `lib`; `components/site` → `components/ui` + `lib`; `app` → anything; nothing imports `app`; `apps/web` never imports `apps/api`. (spec §4.3)
- **Commit scopes** `web`, `config`, `persian`, `ci`, `docs`; conventional commits; every task ends with `pnpm check` green. Lint runs as `eslint .`, never `next lint`.
- **If any download or install answers HTTP 403**, stop and tell Saman to switch the VPN exit before retrying. Never work around it.

## Review Focus

Five failure modes the spec implies but that no happy path would exercise. Each has a test pinned to the task that owns the code.

1. **`cn()` drops `text-body` as a colour conflict.** `tailwind-merge` ships Tailwind's default scales; §5.1 deletes them, so with the default config `text-body` is not a font size and `cn('text-body', 'text-foreground')` returns only `text-foreground` — every primitive would silently lose its type size wherever a colour class follows. Task 3 extends the merge config with the eight sizes and every deleted scale, and its test asserts both `cn('text-body', 'text-foreground')` keeps both and `cn('text-small', 'text-body')` keeps the later size.
2. **A stored theme value the app does not know.** `localStorage['ds-theme'] = 'blue'` — from an older build, a typo in devtools, or another app on `localhost` — makes `next-themes` write `data-theme="blue"`, which matches no token block. The page must still render light (the `:root` block) and the toggle must still work. Task 11 seeds that value before load and asserts `/` is usable and choosing «تاریک» recovers.
3. **The footer year at Nowruz midnight, Tehran time.** `formatJalaliYear` must switch to ۱۴۰۵ at 00:00 Asia/Tehran on 1 Farvardin, not at 00:00 UTC three and a half hours later. Task 1 pins `2026-03-20T19:00:00Z` → «۱۴۰۴» and `2026-03-20T21:00:00Z` → «۱۴۰۵».
4. **A price whose "original" is not higher.** `Price` receives `original` equal to or below `amountMinor` (a stale discount, a data-entry slip). It must show neither a struck price nor a discount badge — never «۰٪ تخفیف» or a negative percentage. Task 6 asserts both cases render only the current price.
5. **A loading button that still accepts clicks.** The loading state keeps the label and the focus (it is not `disabled`), so a second click during a slow submit would double-submit. Task 6 asserts a click on a loading button does not reach the handler, and that the button is still in the tab order with `aria-busy="true"`.

## Deviations from the spec — read first, veto any

Each is a judgement made while writing the code below. Each is small, and each is here so Saman can reject it before it exists.

1. **`components.json` and `lib/utils.ts` are written by hand, not by `pnpm dlx shadcn@4.21.0 init`** (spec §4.1). Verified on 2026-09-25 against the CLI source and the registry item it installs: `init -b base -p nova --rtl --pointer` resolves to the `base-nova` base item, which adds `shadcn@latest` as a **runtime** dependency, `tw-animate-css`, the `cn` npm package (a compiled clsx/tailwind-merge replacement with its own bundler plugins) and a `font-inter` item, writes `@import "shadcn/tailwind.css"` and `@import "tw-animate-css"` into `globals.css`, and would fail under `catalogMode: strict` before writing any of it. The two files the spec wanted to keep are eleven lines; Task 2 writes them to the exact shape the CLI produces (`style: "base-nova"`, `rtl: true`, `iconLibrary: "lucide"`), so a later `shadcn add` works unchanged. `cn` stays `clsx` + `tailwind-merge` as Appendix A pins.
2. **`'use client'` appears in five files, not two** (spec §4.4): the provider, the theme toggle, the text field — and `app/error.tsx` and `app/global-error.tsx`, which Next.js requires to be client components. The two error boundaries are not primitives; the docs task records the correction in §4.4.
3. **`Button` is a plain `<button>`, not Base UI's `Button`.** Base UI's needs `'use client'`; a native button with `cva` variants is a server component, ships no JavaScript, and loses nothing the spec asks for. Base UI is used where it earns its cost: Field (aria wiring) and Menu (keyboard, portal, positioning).
4. **`@ds/persian` gains `formatJalaliYear`.** The footer shows the year in Persian digits (spec §8.1); computing a Jalali year is formatting, and formatting lives only in `@ds/persian` (`.claude/rules/persian.md`). The footer reads it inside `'use cache'` with `cacheLife('days')`, because Cache Components forbid `new Date()` in a prerendered component.
5. **`@vitejs/plugin-react` is not installed.** Vite 8 transforms `.tsx` with Oxc and its automatic JSX runtime; the vitest config sets `oxc.jsx.runtime` explicitly. `@next/playwright` 16.3.6 is pinned in the catalog as Appendix A says but not installed: its only export, `instant()`, tests navigations, and 3a has none.
6. **The lint regression suite is a Vitest test, not a shell script.** `scripts/test-rtl-rule.sh` is deleted with `rtl.js`; its eight cases plus the variant case, and every DoD 6 case, live in `apps/web/test/lint.test.ts`, which runs in `pnpm check`.
7. **Two utilities beyond the spec's list:** `popup` (the §7.1 materialise-from-trigger transition, so it is defined once) and `skeleton` (the shimmer and its reduced-motion fallback). Both are on `/design`.
8. **The loading button.** "The spinner takes the icon slot, the label stays, the width never changes" is satisfiable only when an icon slot exists. With an `icon`, the spinner replaces it. Without one, the spinner is centred over the label, which stays in the DOM at `opacity: 0` — width constant, label announced, `aria-busy` set.

---

## File Structure

Everything created or modified in this phase. Responsibilities are one line each; the tasks hold the code.

| Path                                                                                                                                                                                                                                                                                    | Responsibility                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/persian/src/format.ts`                                                                                                                                                                                                                                                        | + `formatJalaliYear` (Task 1)                                               |
| `pnpm-workspace.yaml`                                                                                                                                                                                                                                                                   | catalog entries for every new pin (Task 2)                                  |
| `apps/web/package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `components.json`, `.env.example`, `vitest.config.ts`, `test/setup.ts`, `test/stubs/server-only.ts`                                                                                                   | the hand-written scaffold (Task 2)                                          |
| `apps/web/app/fonts/Vazirmatn[wght].woff2`, `OFL.txt`, `apps/web/app/fonts.ts`                                                                                                                                                                                                          | the vendored typeface and its one loader (Task 2)                           |
| `apps/web/lib/env.ts`, `lib/site.ts`                                                                                                                                                                                                                                                    | lazy server env; build-time site URL (Task 2)                               |
| `apps/web/app/health/route.ts`, `app/robots.ts`                                                                                                                                                                                                                                         | foundation §7.5 / §7.7 (Task 2)                                             |
| `turbo.json`, root `package.json`, `.gitignore`, `.gitattributes`                                                                                                                                                                                                                       | web tasks, `budget` in `check`, `e2e:install` (Tasks 2, 10)                 |
| `apps/web/app/globals.css`                                                                                                                                                                                                                                                              | the design system's source of truth (Task 3)                                |
| `apps/web/lib/utils.ts`                                                                                                                                                                                                                                                                 | `cn()` with the deleted scales taught to tailwind-merge (Task 3)            |
| `apps/web/test/helpers/color.ts`, `test/tokens.test.ts`                                                                                                                                                                                                                                 | contrast maths; drift and contrast guard (Task 3)                           |
| `packages/config-eslint/next.js`, `next.d.ts`, `web-alias-resolver.js`, `package.json`                                                                                                                                                                                                  | the three-layer web lint config; `rtl.js` deleted (Task 4)                  |
| `apps/web/eslint.config.js`, `prettier.config.mjs`, `apps/web/test/lint.test.ts`, `scripts/check-docs.manifest`                                                                                                                                                                         | wiring and the regression suite (Task 4)                                    |
| `apps/web/lib/copy.ts`, `icons.ts`, `errors.ts`, `motion.ts`                                                                                                                                                                                                                            | Persian strings, semantic icons, code → message, spring parameters (Task 5) |
| `apps/web/components/ui/button.tsx`, `link.tsx`, `surface.tsx`, `badge.tsx`, `skeleton.tsx`, `price.tsx`, `empty-state.tsx`                                                                                                                                                             | server primitives (Task 6)                                                  |
| `apps/web/components/ui/text-field.tsx`, `components/site/theme-toggle.tsx`, `components/site/providers.tsx`                                                                                                                                                                            | client primitives (Task 7)                                                  |
| `apps/web/components/site/wordmark.tsx`, `header.tsx`, `footer.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`                                                                                                                     | the shell (Task 8)                                                          |
| `apps/web/app/design/page.tsx`, `theme-panel.tsx`, `sections/*.tsx`                                                                                                                                                                                                                     | the gallery (Task 9)                                                        |
| `apps/web/vitest.budget.config.ts`, `test/budget.test.ts`, `.github/workflows/ci.yml` (`check` env)                                                                                                                                                                                     | budgets (Task 10)                                                           |
| `apps/web/playwright.config.ts`, `e2e/*.spec.ts`, `.github/workflows/ci.yml` (`e2e` job)                                                                                                                                                                                                | end to end (Task 11)                                                        |
| `docs/decisions/0019-two-colour-design-tokens.md`, `.claude/rules/web.md`, `apps/web/CLAUDE.md`, `.claude/agents/reviewer.md`, `README.md`, `CLAUDE.md`, foundation spec, `docs/architecture/north-star.md`, `.github/renovate.json`, `scripts/check-docs.sh`, the 3a spec's Status row | documentation and amendments (Task 12)                                      |

**Model routing (Saman, 2026-09-24):** Fable 5.1 for Tasks 2, 3, 4, 6, 7, 8, 9, 11; Opus 5.5 for Tasks 1, 5, 10, 12. Quality over tokens — when in doubt, Fable.

**Commands and permissions.** `pnpm install`, `pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e*`, `pnpm format*` and `git add/commit` are pre-approved; `pnpm --filter …`, `pnpm add …` and `pnpm dlx …` ask. Turbo forwards filters, so use `pnpm test --filter=web`, `pnpm build --filter=web`, `pnpm lint --filter=web` and `pnpm typecheck --filter=web` — pre-approved forms that run one package. `curl` and `wget` are denied; downloads use `node -e` with `fetch`. Never `pnpm exec`.

---

## Task 1: `@ds/persian` — `formatJalaliYear`

Spec §8.1 (the footer's year in Persian digits) and `.claude/rules/persian.md` (formatting lives only here). Deviation 4.

**Files:**

- Modify: `packages/persian/src/format.ts`, `packages/persian/src/index.ts`
- Test: `packages/persian/src/format.test.ts` (append)

**Interfaces:**

- Consumes: `TEHRAN_TZ` from the same file.
- Produces: `formatJalaliYear(date: Date): string` — the Jalali year in Persian digits for that instant in Tehran time, e.g. `'۱۴۰۵'`.

- [ ] **Step 1: Write the failing test**

Append to `packages/persian/src/format.test.ts`:

```ts
describe('formatJalaliYear', () => {
  it('returns the Jalali year in Persian digits', () => {
    expect(formatJalaliYear(new Date('2026-09-25T12:00:00Z'))).toBe('۱۴۰۵')
  })

  it('turns the year over at midnight in Tehran, not in UTC', () => {
    // 1 Farvardin 1405 is 2026-03-21. Tehran is UTC+03:30, so 19:00Z is still
    // 22:30 on 29 Esfand 1404 and 21:00Z is 00:30 on 1 Farvardin 1405.
    expect(formatJalaliYear(new Date('2026-03-20T19:00:00Z'))).toBe('۱۴۰۴')
    expect(formatJalaliYear(new Date('2026-03-20T21:00:00Z'))).toBe('۱۴۰۵')
  })

  it('emits no ASCII digit', () => {
    expect(formatJalaliYear(new Date())).not.toMatch(/[0-9]/)
  })
})
```

Add `formatJalaliYear` to the file's existing import from `./format.js`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=@ds/persian`
Expected: FAIL — `formatJalaliYear` is not exported (a type error or "is not a function").

- [ ] **Step 3: Implement**

In `packages/persian/src/format.ts`, after `jalaliLong`:

```ts
const jalaliYear = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  timeZone: TEHRAN_TZ,
  year: 'numeric',
})

/** The Jalali year in Persian digits — «۱۴۰۵» for any instant of 1405, Tehran time. */
export function formatJalaliYear(date: Date): string {
  return jalaliYear.format(date)
}
```

In `packages/persian/src/index.ts`, extend the format export line:

```ts
export { TEHRAN_TZ, formatJalali, formatJalaliYear, formatNumber, formatToman } from './format.js'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --filter=@ds/persian`
Expected: PASS, including the two Nowruz instants.

- [ ] **Step 5: Verify and commit**

Run: `pnpm check`
Expected: green.

```bash
git add packages/persian/src/format.ts packages/persian/src/format.test.ts packages/persian/src/index.ts
git commit -m "feat(persian): add formatJalaliYear for the storefront footer"
```

---

## Task 2: Scaffold `apps/web` — configuration, the typeface, the lazy env, the first build

Foundation §7.1 (hand-written, no `create-next-app`), §7.2 (font loading), §7.5 (`/health`), §7.7 (`robots.ts`), spec §4.1–§4.2, §4.6, Appendix A–B. This task ends with a production build that succeeds against an unreachable API (DoD 5) and a unit suite that runs.

`app/globals.css` and `app/layout.tsx` are placeholders here; Task 3 and Task 8 replace them. The point of this task is that everything around them — catalog, package, TypeScript, Next, PostCSS, Vitest, turbo, the font — is right and proven by a build.

**Files:**

- Modify: `pnpm-workspace.yaml`, `turbo.json`, `package.json` (root), `.gitignore`, `.gitattributes`
- Create: `apps/web/package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `components.json`, `.env.example`, `vitest.config.ts`, `test/setup.ts`, `test/stubs/server-only.ts`
- Create: `apps/web/app/fonts/Vazirmatn[wght].woff2`, `app/fonts/OFL.txt`, `app/fonts.ts`, `app/globals.css` (placeholder), `app/layout.tsx` (placeholder), `app/page.tsx` (placeholder), `app/health/route.ts`, `app/robots.ts`
- Create: `apps/web/lib/env.ts`, `lib/site.ts`
- Test: `apps/web/test/env.test.ts`, `test/site.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `getServerEnv(): { NODE_ENV: 'development' | 'test' | 'production'; API_INTERNAL_URL: string }` (throws on an invalid environment; never called at import) · `siteUrl(): URL` (build-time, throws when `NEXT_PUBLIC_SITE_URL` is absent) · `vazirmatn` from `app/fonts.ts` (`vazirmatn.variable` is the class that defines `--font-vazirmatn`) · the `@/*` alias · the vitest config every later test file assumes (jsdom, `@/`, `server-only` stubbed, jest-dom matchers, cleanup after each test).

- [ ] **Step 1: Add the catalog entries**

In `pnpm-workspace.yaml`, under `catalog:`, after the existing `openapi-fetch` line, add (all verified on npm 2026-09-25, all older than 24 h):

```yaml
'@types/react': 19.3.0
'@types/react-dom': 19.3.0
'@tailwindcss/postcss': 4.3.3
postcss: 8.5.28
next-themes: 0.4.6
clsx: 2.1.1
tailwind-merge: 3.7.0
class-variance-authority: 0.7.1
server-only: 0.0.1
jsdom: 30.1.1
'@testing-library/dom': 10.4.2
'@testing-library/react': 16.3.3
'@testing-library/jest-dom': 7.0.1
'@testing-library/user-event': 14.6.7
eslint-plugin-better-tailwindcss: 4.7.0
'@next/playwright': 16.3.6
```

- [ ] **Step 2: Write `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run",
    "e2e": "playwright test",
    "e2e:install": "playwright install chromium"
  },
  "dependencies": {
    "@base-ui/react": "catalog:",
    "@ds/contracts": "workspace:*",
    "@ds/persian": "workspace:*",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "lucide-react": "catalog:",
    "next": "catalog:",
    "next-themes": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "server-only": "catalog:",
    "tailwind-merge": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@axe-core/playwright": "catalog:",
    "@ds/config-eslint": "workspace:*",
    "@ds/config-typescript": "workspace:*",
    "@playwright/test": "catalog:",
    "@tailwindcss/postcss": "catalog:",
    "@testing-library/dom": "catalog:",
    "@testing-library/jest-dom": "catalog:",
    "@testing-library/react": "catalog:",
    "@testing-library/user-event": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "babel-plugin-react-compiler": "catalog:",
    "eslint": "catalog:",
    "jsdom": "catalog:",
    "postcss": "catalog:",
    "tailwindcss": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`typecheck` runs `next typegen` first: Next 16 writes `next-env.d.ts` (which references `.next/types/routes.d.ts`) only from `dev`, `build` or `typegen`, and a bare `tsc --noEmit` on a fresh clone would otherwise fail on the missing reference. There is deliberately no `budget` script yet: turbo runs a task only in packages that define the script, so `pnpm check` stays green until Task 10 adds `budget` together with its config. `e2e` and `e2e:install` are declared now because the root script in Step 10 names them; their config arrives in Task 11.

- [ ] **Step 3: Write the TypeScript, Next, PostCSS and shadcn configuration**

`apps/web/tsconfig.json`:

```json
{
  "extends": "@ds/config-typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "eslint.config.js",
    "postcss.config.mjs"
  ],
  "exclude": ["node_modules", "coverage", "playwright-report", "test-results"]
}
```

`exclude` deliberately omits `.next`: `exclude` overrides the base config's list rather than merging with it, and the generated route types must stay reachable through the explicit `.next/types/**/*.ts` include. `**/*.ts` never descends into a dot-directory, so nothing else under `.next` is picked up.

`apps/web/next.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

// Foundation §7.1. Every flag here is binding; none reads the environment,
// so `next typegen` and `next build` load it identically.
const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
}

export default nextConfig
```

`apps/web/postcss.config.mjs`:

```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

`apps/web/components.json` — the file `shadcn@4.21.0 init -b base -p nova --rtl --pointer` writes, minus what Deviation 1 keeps out:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": true,
  "menuColor": "default",
  "menuAccent": "subtle",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

`apps/web/.env.example` (spec Appendix B):

```
NODE_ENV=development
PORT=3000
API_INTERNAL_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 4: Write the Vitest configuration and its two support files**

`apps/web/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // The `@/` alias tsconfig.json declares (and shadcn writes).
      '@': root,
      // `server-only` throws outside a React Server Components runtime; the
      // components that import it are rendered here as plain functions.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  // Vite 8 transforms .tsx with Oxc. Automatic is its default; stated so the
  // absence of @vitejs/plugin-react (plan deviation 5) is visibly deliberate.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    // Unit only. test/budget.test.ts needs a production build and runs under
    // vitest.budget.config.ts (Task 10).
    include: [
      'app/**/*.test.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'test/*.test.{ts,tsx}',
    ],
    exclude: ['test/budget.test.ts'],
    setupFiles: ['./test/setup.ts'],
    clearMocks: true,
    css: false,
  },
})
```

`apps/web/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library only auto-cleans when `afterEach` is a global; it is not.
afterEach(() => {
  cleanup()
})
```

`apps/web/test/stubs/server-only.ts`:

```ts
// Stands in for the `server-only` package under Vitest (see vitest.config.ts).
export {}
```

- [ ] **Step 5: Vendor Vazirmatn with its license**

`curl` is denied; use Node. From the repo root:

```bash
mkdir -p apps/web/app/fonts && node -e '
const fs = require("node:fs"); const crypto = require("node:crypto");
const files = [
  ["apps/web/app/fonts/Vazirmatn[wght].woff2", "https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn%5Bwght%5D.woff2", "4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92", 111152],
  ["apps/web/app/fonts/OFL.txt", "https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/OFL.txt", "17e355067c8284f47743a1ee3b1ef7ff684ff0601eda357f9353b10b3016ab31", 4391],
];
(async () => {
  for (const [path, url, sha, size] of files) {
    const res = await fetch(url);
    if (res.status !== 200) throw new Error(`${url} -> HTTP ${res.status} (403 means: ask Saman to switch the VPN)`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = crypto.createHash("sha256").update(buf).digest("hex");
    if (buf.length !== size || got !== sha) throw new Error(`${path}: expected ${size} B ${sha}, got ${buf.length} B ${got}`);
    fs.writeFileSync(path, buf); console.log("ok", path, buf.length);
  }
})();'
```

Expected: `ok … 111152` and `ok … 4391`. The hashes were taken from the same URLs on 2026-09-25; a mismatch means the CDN served something else — stop and say so.

Append to `.gitattributes`:

```
*.woff2 binary
```

`apps/web/app/fonts.ts` — the one place the font is loaded (foundation §7.2); `app/layout.tsx` and `app/global-error.tsx` both import it:

```ts
import localFont from 'next/font/local'

// Foundation §7.2: vendored, variable, swapped in over the system fallback.
// Latin glyphs are built in, so a brand name never falls to a second face.
export const vazirmatn = localFont({
  src: './fonts/Vazirmatn[wght].woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-vazirmatn',
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
})
```

If Turbopack rejects the bracketed file name, rename the file to `vazirmatn-variable.woff2`, update `src` and Task 10's budget path, and say so in the task report — the spec's file name is a convenience, not a requirement.

- [ ] **Step 6: Write the placeholder stylesheet, layout and page**

`apps/web/app/globals.css` (Task 3 replaces this entirely):

```css
@import 'tailwindcss';
```

`apps/web/app/layout.tsx` (Task 8 replaces this):

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { vazirmatn } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'دبی ساپلیمنت',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
```

`apps/web/app/page.tsx` (Task 8 replaces this):

```tsx
export default function HomePage() {
  return <h1>دبی ساپلیمنت</h1>
}
```

- [ ] **Step 7: Write the health route and robots**

`apps/web/app/health/route.ts` (foundation §7.5):

```ts
import { connection } from 'next/server'

export async function GET() {
  // Request-time by declaration: this handler is never prerendered.
  await connection()
  return Response.json({ status: 'ok' })
}
```

`apps/web/app/robots.ts` (foundation §7.7; the sitemap entry arrives in 3c). `/design` is not disallowed on purpose — a crawler must be able to fetch it to read its `noindex`:

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
  }
}
```

- [ ] **Step 8: Write the failing env and site tests**

`apps/web/test/env.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

const realEnv = process.env

afterEach(() => {
  process.env = realEnv
  vi.resetModules()
})

describe('lib/env', () => {
  it('does not read API_INTERNAL_URL at import time', async () => {
    const reads: string[] = []
    process.env = new Proxy({} as NodeJS.ProcessEnv, {
      get(_target, key) {
        reads.push(String(key))
        return undefined
      },
    })
    await import('../lib/env')
    expect(reads).not.toContain('API_INTERNAL_URL')
  })

  it('rejects a missing API_INTERNAL_URL when called', async () => {
    process.env = { ...realEnv, API_INTERNAL_URL: undefined, NODE_ENV: 'test' }
    const { getServerEnv } = await import('../lib/env')
    expect(() => getServerEnv()).toThrow(/API_INTERNAL_URL/)
  })

  it('rejects a value that is not a URL', async () => {
    process.env = { ...realEnv, API_INTERNAL_URL: 'not a url', NODE_ENV: 'test' }
    const { getServerEnv } = await import('../lib/env')
    expect(() => getServerEnv()).toThrow(/API_INTERNAL_URL/)
  })

  it('returns the parsed environment', async () => {
    process.env = { ...realEnv, API_INTERNAL_URL: 'http://127.0.0.1:9', NODE_ENV: 'test' }
    const { getServerEnv } = await import('../lib/env')
    expect(getServerEnv()).toEqual({ NODE_ENV: 'test', API_INTERNAL_URL: 'http://127.0.0.1:9' })
  })
})
```

`apps/web/test/site.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { siteUrl } from '../lib/site'

const realEnv = process.env

afterEach(() => {
  process.env = realEnv
})

describe('siteUrl', () => {
  it('parses NEXT_PUBLIC_SITE_URL', () => {
    process.env = { ...realEnv, NEXT_PUBLIC_SITE_URL: 'https://example.ir' }
    expect(siteUrl().href).toBe('https://example.ir/')
  })

  it('fails loudly when the build-time value is missing', () => {
    process.env = { ...realEnv, NEXT_PUBLIC_SITE_URL: undefined }
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/)
  })
})
```

- [ ] **Step 9: Write `lib/env.ts` and `lib/site.ts`**

`apps/web/lib/env.ts`:

```ts
import 'server-only'
import { z } from 'zod'

// Foundation §7.1. Parsed when called — by `publicApi` at request time from
// 3b onward — and never at import, so `next build` needs no API and DoD 9's
// build against `http://127.0.0.1:9` stays honest.
const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_INTERNAL_URL: z.url(),
})

export type ServerEnv = z.infer<typeof ServerEnvSchema>

export function getServerEnv(): ServerEnv {
  return ServerEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  })
}
```

`apps/web/lib/site.ts`:

```ts
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
```

- [ ] **Step 10: Declare the turbo tasks and the root scripts**

In `turbo.json`, add after `"api#openapi"` (strict JSON — no comments; `apps/api/test/boundaries.test.ts` parses it). `budget` is declared as a root task, which turbo runs in every package that has the script and skips elsewhere; a `web#budget` override would be rejected until the script exists in Task 10:

```json
    "budget": { "dependsOn": ["build"], "outputs": [] },
    "web#test": { "dependsOn": ["^build"], "env": ["NODE_ENV"] },
    "web#e2e": {
      "dependsOn": ["build"],
      "cache": false,
      "env": ["NODE_ENV", "PORT", "API_INTERNAL_URL", "NEXT_PUBLIC_SITE_URL"],
      "passThroughEnv": ["CI", "HOME", "PLAYWRIGHT_BROWSERS_PATH"]
    },
```

In the root `package.json`, add `budget` to both check scripts and add the browser-install script:

```json
    "check": "turbo run lint typecheck test test:integration boundaries budget --output-logs=errors-only && sherif && pnpm check:docs && pnpm format:check",
    "check:affected": "turbo run lint typecheck test test:integration boundaries budget --affected --output-logs=errors-only && sherif && pnpm check:docs && pnpm format:check",
    "e2e:install": "pnpm --filter web e2e:install",
```

Append to `.gitignore`:

```
next-env.d.ts
```

- [ ] **Step 11: Install and run the unit tests**

Run: `pnpm install`
Expected: succeeds; the lockfile gains the new packages. A 403 from the registry means the VPN — stop and ask.

Run: `cp apps/web/.env.example apps/web/.env`
Expected: the git-ignored local env now exists. `next build` and `next start` read it from disk, so `pnpm check` (which builds web from Task 10 on) and `pnpm e2e` need no variables in the shell. Never read the file back.

Run: `pnpm test --filter=web`
Expected: the six tests in `test/env.test.ts` and `test/site.test.ts` PASS. (Step 8 was written before Step 9; if you ran the suite between them you saw the import failures. Record that in the task report.)

- [ ] **Step 12: Build against an unreachable API (DoD 5)**

Run: `API_INTERNAL_URL=http://127.0.0.1:9 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm build --filter=web`
Expected: `next build` succeeds; `/` and `/robots.txt` are static, `/health` is dynamic.

Run: `pnpm check`
Expected: green — web's `lint` (the root base config applies until Task 4 gives `apps/web` its own), `typecheck` and `test` now run inside it. Prettier may reformat the JSON files you wrote; commit the formatted result. `web#budget` does not run because the script does not exist yet.

- [ ] **Step 13: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml turbo.json package.json .gitignore .gitattributes apps/web
git commit -m "feat(web): scaffold the storefront with a lazy server env and the vendored typeface"
```

`pnpm-lock.yaml` is Edit-denied for the agent but written by `pnpm install`; it is committed with the package files that changed it.

---

## Task 3: Tokens — `app/globals.css`, `cn()`, and the contrast test

Spec §5 (tokens and theming), §6.1–§6.2 (weights and the type scale), §7.2 (motion tokens), §7.4 (preferences), §10.1 (`test/tokens.test.ts`), DoD 7. Review Focus 1.

The stylesheet is written once, completely. Every later component reads only what is defined here. The test re-derives every neutral from the two primitives at the spec's percentages and fails when a committed hex drifts or a pair drops below its threshold.

**Files:**

- Create: `apps/web/test/helpers/color.ts`, `apps/web/lib/utils.ts`
- Replace: `apps/web/app/globals.css`
- Test: `apps/web/test/tokens.test.ts`, `apps/web/lib/utils.test.ts`

**Interfaces:**

- Consumes: the scaffold from Task 2.
- Produces: `cn(...inputs: ClassValue[]): string` · the utilities and variants every component uses: `text-caption|small|body|lead|title-sm|title|headline|display`, `font-normal|medium|semibold|bold|extrabold`, `rounded-sm|md|lg|full`, `shadow-sm|md|material`, `ease-out|in`, `animate-shimmer|spin`, `bg-/text-/border-` over `background foreground card card-foreground popover popover-foreground primary primary-foreground secondary secondary-foreground muted muted-foreground accent accent-foreground destructive destructive-foreground border input ring`, the `dark:` variant keyed on `data-theme`, and the custom utilities `container-page prose material press focus-ring popup skeleton z-header z-overlay z-sheet z-toast`; the CSS variables `--duration-press|quick|fade`, `--z-*`, `--container-page|prose`.

- [ ] **Step 1: Write the colour maths and the failing token test**

`apps/web/test/helpers/color.ts`:

```ts
export type Rgb = readonly [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const digits = match?.[1]
  if (digits === undefined) throw new Error(`not a six-digit hex colour: ${hex}`)
  const n = Number.parseInt(digits, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** `fg` mixed over `bg` at fraction `p` in sRGB — the spec's "X% over Y" (§5.1). */
export function mix(fg: Rgb, bg: Rgb, p: number): Rgb {
  const channel = (i: 0 | 1 | 2) => Math.round(bg[i] + (fg[i] - bg[i]) * p)
  return [channel(0), channel(1), channel(2)]
}

function linear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2.x contrast ratio; the order of the arguments does not matter. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
```

`apps/web/test/tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrast, hexToRgb, mix, toHex, type Rgb } from './helpers/color'

const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8')

function block(pattern: RegExp): Record<string, string> {
  const body = pattern.exec(css)?.[1]
  if (body === undefined) throw new Error(`token block not found: ${pattern}`)
  const tokens: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/--([a-z][a-z0-9-]*):\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) tokens[name] = value.trim()
  }
  return tokens
}

// The first @theme block closes at the first `}` that starts a line.
const primitives = block(/@theme\s*\{([\s\S]*?)\n\}/)
const light = block(/:root,\s*\[data-theme=['"]light['"]\]\s*\{([^}]*)\}/)
const dark = block(/\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/)

const IRIS = hexToRgb(primitives['color-iris'] ?? '')
const FROZEN = hexToRgb(primitives['color-frozen'] ?? '')
const PAPER = hexToRgb('#fafafc')
const WHITE = hexToRgb('#ffffff')

type Tokens = Record<string, string>

function solid(tokens: Tokens, name: string): Rgb {
  const value = tokens[name]
  if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(
      `--${name} must be a solid six-digit hex (spec §5.1), got: ${value ?? 'nothing'}`,
    )
  }
  return hexToRgb(value)
}

function alpha(tokens: Tokens, name: string): { alpha: number; over: (bg: Rgb) => Rgb } {
  const match = /^color-mix\(in srgb, var\(--color-(iris|frozen)\) (\d+)%, transparent\)$/.exec(
    tokens[name] ?? '',
  )
  if (!match)
    throw new Error(
      `--${name} must be color-mix(in srgb, var(--color-iris|frozen) N%, transparent)`,
    )
  const ink = match[1] === 'iris' ? IRIS : FROZEN
  const fraction = Number(match[2]) / 100
  return { alpha: fraction, over: (bg) => mix(ink, bg, fraction) }
}

describe('primitives', () => {
  it('are Black Iris and Frozen (D9)', () => {
    expect(toHex(IRIS)).toBe('#080813')
    expect(toHex(FROZEN)).toBe('#a0bddb')
  })

  it('delete every default scale a third colour or size could hide in (§5.1)', () => {
    for (const ns of ['color', 'text', 'radius', 'shadow', 'ease', 'animate', 'font-weight']) {
      expect(css).toContain(`--${ns}-*: initial`)
    }
  })

  it('never use oklch (the shadcn theme was replaced)', () => {
    expect(css).not.toMatch(/oklch\(/)
  })
})

describe('light tokens are derived, not typed (§5.2)', () => {
  it.each<[string, Rgb]>([
    ['background', PAPER],
    ['foreground', IRIS],
    ['card', WHITE],
    ['card-foreground', IRIS],
    ['popover', WHITE],
    ['popover-foreground', IRIS],
    ['primary', FROZEN],
    ['primary-foreground', IRIS],
    ['secondary', mix(IRIS, PAPER, 0.06)],
    ['secondary-foreground', IRIS],
    ['muted', mix(IRIS, PAPER, 0.04)],
    ['muted-foreground', mix(IRIS, PAPER, 0.62)],
    ['accent', mix(FROZEN, PAPER, 0.24)],
    ['accent-foreground', IRIS],
    ['destructive', hexToRgb('#b3261e')],
    ['destructive-foreground', WHITE],
    ['ring', IRIS],
  ])('--%s', (name, expected) => {
    expect(toHex(solid(light, name))).toBe(toHex(expected))
  })

  it('carries alpha only on the two non-text tokens, at 12% and 48%', () => {
    expect(alpha(light, 'border').alpha).toBe(0.12)
    expect(alpha(light, 'input').alpha).toBe(0.48)
    for (const [name, value] of Object.entries(light)) {
      if (value.startsWith('color-mix')) expect(['border', 'input']).toContain(name)
    }
  })
})

describe('dark tokens are derived, not typed (§5.3)', () => {
  it.each<[string, Rgb]>([
    ['background', IRIS],
    ['foreground', FROZEN],
    ['card', mix(FROZEN, IRIS, 0.06)],
    ['card-foreground', FROZEN],
    ['popover', mix(FROZEN, IRIS, 0.06)],
    ['popover-foreground', FROZEN],
    ['primary', FROZEN],
    ['primary-foreground', IRIS],
    ['secondary', mix(FROZEN, IRIS, 0.12)],
    ['secondary-foreground', FROZEN],
    ['muted', mix(FROZEN, IRIS, 0.08)],
    ['muted-foreground', mix(FROZEN, IRIS, 0.7)],
    ['accent', mix(FROZEN, IRIS, 0.18)],
    ['accent-foreground', FROZEN],
    ['destructive', hexToRgb('#f28b82')],
    ['destructive-foreground', IRIS],
    ['ring', FROZEN],
  ])('--%s', (name, expected) => {
    expect(toHex(solid(dark, name))).toBe(toHex(expected))
  })

  it('carries alpha only on the two non-text tokens, at 16% and 52%', () => {
    expect(alpha(dark, 'border').alpha).toBe(0.16)
    expect(alpha(dark, 'input').alpha).toBe(0.52)
    for (const [name, value] of Object.entries(dark)) {
      if (value.startsWith('color-mix')) expect(['border', 'input']).toContain(name)
    }
  })
})

const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'card'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'background'],
  ['destructive', 'card'],
]

describe.each<[string, Tokens]>([
  ['light', light],
  ['dark', dark],
])('%s contrast (WCAG 1.4.3 and 1.4.11)', (_theme, tokens) => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(solid(tokens, fg), solid(tokens, bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['background', 'card'])('the control boundary over %s is at least 3:1', (bg) => {
    const surface = solid(tokens, bg)
    expect(contrast(alpha(tokens, 'input').over(surface), surface)).toBeGreaterThanOrEqual(3)
  })

  it('the focus ring over the page is at least 3:1', () => {
    expect(contrast(solid(tokens, 'ring'), solid(tokens, 'background'))).toBeGreaterThanOrEqual(3)
  })

  it('every surface token has its text partner', () => {
    for (const name of Object.keys(tokens)) {
      if (name.endsWith('-foreground') || ['border', 'input', 'ring'].includes(name)) continue
      const partner = name === 'background' ? 'foreground' : `${name}-foreground`
      expect(tokens[partner], `--${name} has no --${partner}`).toBeDefined()
    }
  })
})

describe('the fill that does not invert (§5.3)', () => {
  it('keeps primary and its label byte-identical across themes', () => {
    expect(light['primary']).toBe(dark['primary'])
    expect(light['primary-foreground']).toBe(dark['primary-foreground'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=web`
Expected: FAIL — "token block not found" (the placeholder stylesheet has no token blocks).

- [ ] **Step 3: Write `app/globals.css`**

Replace the placeholder with this file, exactly:

```css
@import 'tailwindcss';

/*
 * The design system's single source of truth (spec §5–§7). Every colour,
 * size, radius, shadow and duration a component uses is a token here;
 * test/tokens.test.ts re-derives the neutrals and checks every pair.
 */

/* ---------- 1. Two colours are a fact (§5.1) ---------- */

@theme {
  /* Tailwind's palette and scales are deleted: bg-blue-500, text-xl,
     shadow-lg, rounded-xl, ease-in-out and font-light do not exist here. */
  --color-*: initial;
  --text-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --ease-*: initial;
  --animate-*: initial;
  --font-weight-*: initial;

  --color-iris: #080813;
  --color-frozen: #a0bddb;

  --font-sans: var(--font-vazirmatn), Tahoma, Arial, sans-serif;

  /* §6.1 — five weights, five roles */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;

  /* §6.2 — the scale; each size carries its leading */
  --text-caption: 0.75rem;
  --text-caption--line-height: 1.6;
  --text-small: 0.875rem;
  --text-small--line-height: 1.7;
  --text-body: 1rem;
  --text-body--line-height: 1.85;
  --text-lead: 1.125rem;
  --text-lead--line-height: 1.75;
  --text-title-sm: 1.25rem;
  --text-title-sm--line-height: 1.5;
  --text-title: 1.5rem;
  --text-title--line-height: 1.45;
  --text-headline: clamp(1.75rem, 1.4rem + 1.5vw, 2.25rem);
  --text-headline--line-height: 1.3;
  --text-display: clamp(2.25rem, 1.75rem + 2.5vw, 3.5rem);
  --text-display--line-height: 1.2;

  /* §5.4 — radius */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;

  /* §5.4 — elevation, always the page's own ink at alpha */
  --shadow-sm:
    0 1px 2px color-mix(in srgb, var(--color-iris) 8%, transparent),
    0 1px 1px color-mix(in srgb, var(--color-iris) 4%, transparent);
  --shadow-md:
    0 4px 12px color-mix(in srgb, var(--color-iris) 12%, transparent),
    0 2px 4px color-mix(in srgb, var(--color-iris) 6%, transparent);
  --shadow-material:
    0 8px 24px color-mix(in srgb, var(--color-iris) 16%, transparent),
    0 1px 2px color-mix(in srgb, var(--color-iris) 8%, transparent);

  /* §7.2 — motion */
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(1, 0, 0.8, 1);
  --animate-shimmer: shimmer 1.6s linear infinite;
  --animate-spin: spin 1s linear infinite;

  @keyframes shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}

/* ---------- 2. Semantic tokens under shadcn's names (§5.2–§5.3) ---------- */
/* Text-carrying tokens are solid hex. Alpha appears only on --border and
   --input. Percentages are "ink mixed over surface" in sRGB. */

:root,
[data-theme='light'] {
  color-scheme: light;
  --background: #fafafc;
  --foreground: #080813;
  --card: #ffffff;
  --card-foreground: #080813;
  --popover: #ffffff;
  --popover-foreground: #080813;
  --primary: #a0bddb;
  --primary-foreground: #080813;
  --secondary: #ebebee;
  --secondary-foreground: #080813;
  --muted: #f0f0f3;
  --muted-foreground: #64646c;
  --accent: #e4ebf4;
  --accent-foreground: #080813;
  --destructive: #b3261e;
  --destructive-foreground: #ffffff;
  --border: color-mix(in srgb, var(--color-iris) 12%, transparent);
  --input: color-mix(in srgb, var(--color-iris) 48%, transparent);
  --ring: #080813;
}

[data-theme='dark'] {
  color-scheme: dark;
  --background: #080813;
  --foreground: #a0bddb;
  --card: #11131f;
  --card-foreground: #a0bddb;
  --popover: #11131f;
  --popover-foreground: #a0bddb;
  --primary: #a0bddb;
  --primary-foreground: #080813;
  --secondary: #1a1e2b;
  --secondary-foreground: #a0bddb;
  --muted: #141623;
  --muted-foreground: #72879f;
  --accent: #232937;
  --accent-foreground: #a0bddb;
  --destructive: #f28b82;
  --destructive-foreground: #080813;
  --border: color-mix(in srgb, var(--color-frozen) 16%, transparent);
  --input: color-mix(in srgb, var(--color-frozen) 52%, transparent);
  --ring: #a0bddb;
}

/* Non-colour tokens that are not Tailwind namespaces (§5.4, §7.2). */
:root {
  --duration-press: 100ms;
  --duration-quick: 150ms;
  --duration-fade: 200ms;
  --z-header: 10;
  --z-overlay: 20;
  --z-sheet: 30;
  --z-toast: 40;
  --container-page: 75rem;
  --container-prose: 42rem;
}

/* §7.4 — a user who asked for more contrast gets solid boundaries and a
   thicker ring. */
@media (prefers-contrast: more) {
  :root,
  [data-theme='light'] {
    --border: var(--color-iris);
    --input: var(--color-iris);
  }
  [data-theme='dark'] {
    --border: var(--color-frozen);
    --input: var(--color-frozen);
  }
  :focus-visible {
    outline-width: 3px;
  }
}

/* ---------- 3. The tokens as utilities: bg-background, text-primary-foreground … ---------- */

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

/* `dark:` follows the attribute next-themes sets, never the OS alone (§5.6);
   the nested selector is what lets a gallery panel force a theme. */
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

/* ---------- 4. Base ---------- */

@layer base {
  * {
    border-color: var(--color-border);
  }

  html {
    font-family: var(--font-sans);
    /* §6.4 — any digit that reaches the page still renders Persian. */
    font-feature-settings: 'ss01';
    /* §6.3 — never set; connected letters tear apart under tracking. */
    letter-spacing: normal;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  body {
    min-block-size: 100dvh;
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-size: var(--text-body);
    line-height: var(--text-body--line-height);
  }

  /* The e-commerce convention (§9, Jakob) — shadcn's --pointer, by hand. */
  button:not(:disabled),
  [role='button']:not(:disabled) {
    cursor: pointer;
  }

  /* §7.1 — instant, 2 px, 2 px outside the control so it sits on the page. */
  :focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
  }

  ::selection {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);
  }

  /* §5.6 — the theme switch is one whole-page cross-fade. */
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: var(--duration-fade);
    animation-timing-function: var(--ease-out);
  }
}

/* ---------- 5. Utilities (§5.4, §5.5, §7, §8.1) ---------- */

@utility container-page {
  inline-size: 100%;
  max-inline-size: var(--container-page);
  margin-inline: auto;
  padding-inline: 1rem;
  @variant md {
    padding-inline: 1.5rem;
  }
}

@utility prose {
  max-inline-size: var(--container-prose);
}

/* §5.5 — floating chrome; solid when the user prefers it. */
@utility material {
  background-color: color-mix(in srgb, var(--color-background) 72%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: var(--shadow-material);
  @media (prefers-reduced-transparency: reduce) {
    background-color: var(--color-background);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

/* §7.1 — respond on pointer-down; colours and shadow follow on hover.
   Under reduced motion the press is gone and only colours cross-fade. */
@utility press {
  transition-property: transform, color, background-color, border-color, box-shadow, opacity;
  transition-duration:
    var(--duration-press), var(--duration-quick), var(--duration-quick), var(--duration-quick),
    var(--duration-quick), var(--duration-quick);
  transition-timing-function: var(--ease-out);
  &:active {
    transform: scale(0.97);
  }
  @media (prefers-reduced-motion: reduce) {
    transition-property: color, background-color, border-color, box-shadow, opacity;
    &:active {
      transform: none;
    }
  }
}

@utility focus-ring {
  outline: 2px solid transparent;
  outline-offset: 2px;
  &:focus-visible {
    outline-color: var(--color-ring);
  }
}

/* §7.1 — overlays materialise from their trigger and leave the same way. */
@utility popup {
  transform-origin: var(--transform-origin);
  transition-property: opacity, transform;
  transition-duration: var(--duration-quick);
  transition-timing-function: var(--ease-out);
  &[data-starting-style],
  &[data-ending-style] {
    opacity: 0;
    transform: scale(0.96);
  }
  &[data-ending-style] {
    transition-timing-function: var(--ease-in);
  }
  @media (prefers-reduced-motion: reduce) {
    transition-property: opacity;
    &[data-starting-style],
    &[data-ending-style] {
      transform: none;
    }
  }
}

/* §8.1 — the shimmer, static under reduced motion. */
@utility skeleton {
  background-color: var(--color-muted);
  background-image: linear-gradient(
    90deg,
    var(--color-muted) 0%,
    var(--color-secondary) 50%,
    var(--color-muted) 100%
  );
  background-size: 200% 100%;
  animation: var(--animate-shimmer);
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background-image: none;
  }
}

/* §5.4 — the only z-indices; numeric z-<n> is banned by lint. */
@utility z-header {
  z-index: var(--z-header);
}
@utility z-overlay {
  z-index: var(--z-overlay);
}
@utility z-sheet {
  z-index: var(--z-sheet);
}
@utility z-toast {
  z-index: var(--z-toast);
}
```

- [ ] **Step 4: Run the token test to verify it passes**

Run: `pnpm test --filter=web`
Expected: PASS — 17 derivations per theme, 12 text pairs and 3 boundary checks per theme, the identical primary, the file checks.

- [ ] **Step 5: Write the failing `cn()` test**

`apps/web/lib/utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a type-scale size next to a text colour (Review Focus 1)', () => {
    expect(cn('text-body', 'text-foreground')).toBe('text-body text-foreground')
  })

  it('lets a later size win over an earlier one', () => {
    expect(cn('text-small', 'text-body')).toBe('text-body')
    expect(cn('text-title', 'text-title-sm')).toBe('text-title-sm')
  })

  it('merges the design system’s other scales', () => {
    expect(cn('rounded-sm', 'rounded-lg')).toBe('rounded-lg')
    expect(cn('shadow-sm', 'shadow-material')).toBe('shadow-material')
    expect(cn('font-medium', 'font-bold')).toBe('font-bold')
    expect(cn('ease-out', 'ease-in')).toBe('ease-in')
    expect(cn('z-header', 'z-toast')).toBe('z-toast')
  })

  it('keeps logical utilities that do not conflict', () => {
    expect(cn('ps-4', 'pe-2')).toBe('ps-4 pe-2')
  })

  it('accepts clsx-style conditionals', () => {
    expect(cn('px-2', { 'px-4': true, hidden: false })).toBe('px-4')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm test --filter=web`
Expected: FAIL — `./utils` does not exist.

- [ ] **Step 7: Write `lib/utils.ts`**

```ts
import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge knows Tailwind's default scales. Spec §5.1 deletes them and
// defines ours, so without this `cn('text-body', 'text-foreground')` would read
// `text-body` as a second colour and drop it. Every deleted namespace that has
// a replacement is listed; keep this in step with app/globals.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['caption', 'small', 'body', 'lead', 'title-sm', 'title', 'headline', 'display'],
      radius: ['sm', 'md', 'lg', 'full'],
      shadow: ['sm', 'md', 'material'],
      ease: ['out', 'in'],
      animate: ['shimmer', 'spin'],
      'font-weight': ['normal', 'medium', 'semibold', 'bold', 'extrabold'],
    },
    classGroups: {
      z: ['z-header', 'z-overlay', 'z-sheet', 'z-toast'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 8: Run the tests to verify they pass, then build**

Run: `pnpm test --filter=web`
Expected: PASS.

Run: `API_INTERNAL_URL=http://127.0.0.1:9 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm build --filter=web`
Expected: succeeds. A CSS error in `@theme`, `@utility` or `@custom-variant` surfaces only here — fix the stylesheet, never the test, if Tailwind rejects a line.

- [ ] **Step 9: Prove the guard by mutation (DoD 7)**

Change `--muted-foreground: #64646c` to `#65656c` in the light block; run `pnpm test --filter=web`; expect the `--muted-foreground` derivation to FAIL. Revert. Change `--input` in the light block to `48%` → `18%`; run again; expect "the control boundary over background is at least 3:1" to FAIL. Revert. Record both failures, verbatim, in the task report.

- [ ] **Step 10: Verify and commit**

Run: `pnpm check`
Expected: green.

```bash
git add apps/web/app/globals.css apps/web/lib/utils.ts apps/web/lib/utils.test.ts apps/web/test/helpers/color.ts apps/web/test/tokens.test.ts
git commit -m "feat(web): define the two-colour design tokens and prove their contrast"
```

---

## Task 4: Lint enforcement — `@ds/config-eslint/next` rebuilt, the regression suite, Prettier's class order

Spec §11 (the three layers), §4.3 (boundaries), §6.3 (the banned classes), DoD 6. Deviation 6.

Every rule the design system has is enforced here or it is not a rule. The regression suite is a Vitest test that lints fixture strings with the non-type-aware layers, so it runs inside `pnpm check` and needs no shell.

**Files:**

- Rewrite: `packages/config-eslint/next.js`; Create: `packages/config-eslint/next.d.ts`, `packages/config-eslint/web-alias-resolver.js`
- Modify: `packages/config-eslint/package.json`, `prettier.config.mjs`, root `package.json`, `scripts/check-docs.manifest`
- Delete: `packages/config-eslint/rtl.js`, `scripts/test-rtl-rule.sh`
- Create: `apps/web/eslint.config.js`
- Test: `apps/web/test/lint.test.ts`

**Interfaces:**

- Consumes: `app/globals.css` (Task 3) as the plugin's `entryPoint`; `lib/env.ts` and `app/layout.tsx` (Task 2) and `lib/utils.ts` (Task 3) as boundary fixture targets.
- Produces: `@ds/config-eslint/next` default export (the full web config) and named export `webRules: Linter.Config[]` (the layers the test lints with); the message prefixes `ui-imports-lib-only`, `site-never-imports-app`, `lib-imports-packages-only`, `no-test-imports`; the `@/` alias resolved for `eslint-plugin-boundaries`.

- [ ] **Step 1: Write the failing regression suite**

`apps/web/test/lint.test.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { webRules } from '@ds/config-eslint/next'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// The non-type-aware layers only (spec §11): every rule under test here is a
// class, syntax, import or boundary rule, none needs a TypeScript program, and
// a virtual file has none. The type-aware base is exercised by `pnpm lint`.
const cwd = fileURLToPath(new URL('../', import.meta.url))
const eslint = new ESLint({ cwd, overrideConfigFile: true, overrideConfig: webRules })

async function lint(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'parse'}: ${m.message}`)
}

const jsx = (className: string) => `export const Fixture = () => <div className="${className}" />\n`
const rule = (id: string) => (message: string) => message.startsWith(`better-tailwindcss/${id}:`)

describe('logical properties (foundation §7.2)', () => {
  it.each([
    'ms-4 me-2 ps-1 pe-3 text-start',
    'rtl:rotate-180',
    'normal-case',
    'z-header leading-relaxed',
    'press focus-ring text-body font-medium text-foreground bg-primary rounded-md shadow-sm ease-out',
  ])('accepts "%s"', async (className) => {
    expect(await lint('components/ui/fixture.tsx', jsx(className))).toEqual([])
  })

  it.each(['ml-4', 'md:ml-4', '-ml-2', 'pl-2', 'border-l-2', 'left-0'])(
    'rejects the physical utility "%s"',
    async (className) => {
      const messages = await lint('components/ui/fixture.tsx', jsx(className))
      expect(messages.some(rule('enforce-logical-properties'))).toBe(true)
    },
  )

  it('rejects a physical utility inside a template literal', async () => {
    const code = 'export const Fixture = () => <div className={`flex mr-2`} />\n'
    const messages = await lint('components/ui/fixture.tsx', code)
    expect(messages.some(rule('enforce-logical-properties'))).toBe(true)
  })
})

describe('unknown classes — the deleted scales (spec §5.1)', () => {
  it.each([
    'bg-blue-500',
    'text-xl',
    'shadow-lg',
    'rounded-xl',
    'ease-in-out',
    'font-light',
    'bg-white',
  ])('rejects "%s"', async (className) => {
    const messages = await lint('components/ui/fixture.tsx', jsx(className))
    expect(messages.some(rule('no-unknown-classes'))).toBe(true)
  })
})

describe('restricted classes (spec §6.3, §11)', () => {
  it.each([
    'bg-[#ff0000]',
    'text-[rgb(0,0,0)]',
    'hover:border-[oklch(0.5_0.1_200)]',
    'tracking-tight',
    'md:tracking-wide',
    'leading-none',
    'leading-tight',
    'text-left',
    'text-right',
    'text-justify',
    'float-left',
    'rounded-tl-lg',
    'z-50',
    'z-[60]',
    '-z-10',
  ])('rejects "%s"', async (className) => {
    const messages = await lint('components/ui/fixture.tsx', jsx(className))
    expect(messages.some(rule('no-restricted-classes'))).toBe(true)
  })
})

describe('conflicts and duplicates', () => {
  it('rejects two classes that set the same property', async () => {
    const messages = await lint('components/ui/fixture.tsx', jsx('ps-2 ps-4'))
    expect(messages.some(rule('no-conflicting-classes'))).toBe(true)
  })

  it('rejects the same class twice', async () => {
    const messages = await lint('components/ui/fixture.tsx', jsx('ps-4 ps-4'))
    expect(messages.some(rule('no-duplicate-classes'))).toBe(true)
  })
})

describe('route segment configs (ADR-0006, spec §11)', () => {
  it.each(['dynamic', 'revalidate', 'fetchCache', 'runtime', 'dynamicParams'])(
    'rejects `export const %s` under app/',
    async (name) => {
      const messages = await lint('app/things/page.tsx', `export const ${name} = 'x'\n`)
      expect(messages.some((m) => m.includes('route-segment-config'))).toBe(true)
    },
  )

  it('accepts `export const metadata` under app/', async () => {
    expect(await lint('app/things/page.tsx', "export const metadata = { title: 'x' }\n")).toEqual(
      [],
    )
  })

  it('does not reach outside app/', async () => {
    expect(await lint('lib/things.ts', "export const dynamic = 'x'\n")).toEqual([])
  })
})

describe('restricted imports (foundation §7.2, spec §8.2)', () => {
  it('rejects lucide-react outside lib/icons.ts', async () => {
    const messages = await lint('components/ui/fixture.tsx', "import { Sun } from 'lucide-react'\n")
    expect(messages.some((m) => m.startsWith('no-restricted-imports:'))).toBe(true)
  })

  it('accepts lucide-react in lib/icons.ts', async () => {
    expect(await lint('lib/icons.ts', "export { Sun } from 'lucide-react'\n")).toEqual([])
  })

  it.each(['app/layout.tsx', 'lib/icons.ts'])('rejects next/font/google in %s', async (file) => {
    const messages = await lint(file, "import { Inter } from 'next/font/google'\n")
    expect(messages.some((m) => m.startsWith('no-restricted-imports:'))).toBe(true)
  })
})

describe('boundaries (spec §4.3)', () => {
  const boundary = (needle: string) => (m: string) =>
    m.startsWith('boundaries/dependencies:') && m.includes(needle)

  it('components/ui may not import app', async () => {
    const messages = await lint('components/ui/fixture.tsx', "import '../../app/layout'\n")
    expect(messages.some(boundary('ui-imports-lib-only'))).toBe(true)
  })

  it('components/site may not import app', async () => {
    const messages = await lint('components/site/fixture.tsx', "import '../../app/layout'\n")
    expect(messages.some(boundary('site-never-imports-app'))).toBe(true)
  })

  it('lib may not import a component or a route', async () => {
    const messages = await lint('lib/fixture.ts', "import '../app/layout'\n")
    expect(messages.some(boundary('lib-imports-packages-only'))).toBe(true)
  })

  it('resolves the @/ alias so an aliased violation is still a violation', async () => {
    const messages = await lint('lib/fixture.ts', "import '@/app/layout'\n")
    expect(messages.some(boundary('lib-imports-packages-only'))).toBe(true)
  })

  it('accepts app importing lib, and ui importing lib through the alias', async () => {
    expect(await lint('app/fixture.tsx', "import '../lib/env'\n")).toEqual([])
    expect(
      await lint('components/ui/fixture.tsx', "import { cn } from '@/lib/utils'\nexport { cn }\n"),
    ).toEqual([])
  })

  it('nothing imports a test file', async () => {
    const messages = await lint('app/fixture.tsx', "import '../test/tokens.test'\n")
    expect(messages.some(boundary('no-test-imports'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test --filter=web`
Expected: FAIL — `@ds/config-eslint/next` has no export `webRules` (and `eslint-plugin-better-tailwindcss` is not installed).

- [ ] **Step 3: Give `@ds/config-eslint` its dependencies and a typed `next` entry**

`packages/config-eslint/package.json`:

```json
{
  "name": "@ds/config-eslint",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./base": "./base.js",
    "./nest": "./nest.js",
    "./next": {
      "types": "./next.d.ts",
      "default": "./next.js"
    }
  },
  "dependencies": {
    "eslint": "catalog:",
    "eslint-config-next": "catalog:",
    "eslint-plugin-better-tailwindcss": "catalog:",
    "eslint-plugin-boundaries": "catalog:",
    "tailwindcss": "catalog:",
    "typescript-eslint": "catalog:"
  },
  "scripts": {
    "lint": "eslint ."
  }
}
```

`tailwindcss` is listed because the plugin declares it as a peer; at lint time the plugin resolves `tailwindcss` from the directory of `entryPoint` (verified in its `context.async.v4.js`), i.e. from `apps/web`. `eslint` is listed because `next.d.ts` names its types.

`packages/config-eslint/next.d.ts`:

```ts
import type { Linter } from 'eslint'

/**
 * The layers that need no type information — the Tailwind rules, the
 * route-segment-config ban, the import bans and the boundaries.
 * apps/web/test/lint.test.ts lints its fixtures with exactly these.
 */
export declare const webRules: Linter.Config[]

declare const config: Linter.Config[]
export default config
```

- [ ] **Step 4: Write the alias resolver**

`packages/config-eslint/web-alias-resolver.js`:

```js
// @ts-check
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'

/**
 * Resolves the `@/x` alias — the one shadcn writes and `apps/web/tsconfig.json`
 * maps to `./x` — to a file on disk, for `eslint-plugin-boundaries`.
 *
 * The plugin classifies an import by its resolved path and skips, silently,
 * any import it cannot resolve; an unresolved `@/app/layout` would therefore
 * be a boundary violation that reports nothing (see esm-ts-resolver.js for the
 * same argument). The alias root is the nearest package.json above the
 * importing file, never `process.cwd()`, so the answer does not depend on the
 * directory ESLint was started from.
 *
 * Only `@/` specifiers are claimed; everything else is declined so the Node
 * resolver configured after it answers.
 */
export const interfaceVersion = 2

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

/** @param {string} file */
function packageRoot(file) {
  let dir = dirname(file)
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return dir
}

/**
 * @param {string} source the specifier as written
 * @param {string} file absolute path of the file that wrote it
 * @returns {{ found: boolean, path?: string }}
 */
export function resolve(source, file) {
  if (!source.startsWith('@/')) return { found: false }
  const root = packageRoot(file)
  if (root === null) return { found: false }

  const target = resolvePath(root, source.slice(2))
  const candidates = [
    target,
    ...EXTENSIONS.map((ext) => `${target}${ext}`),
    ...EXTENSIONS.map((ext) => join(target, `index${ext}`)),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile())
      return { found: true, path: candidate }
  }
  return { found: false }
}
```

- [ ] **Step 5: Rewrite `packages/config-eslint/next.js`**

```js
// @ts-check
import { fileURLToPath } from 'node:url'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'
import base from './base.js'

// Three layers on the strict TypeScript base (3a spec §11):
//   1. eslint-config-next — react, react-hooks, jsx-a11y, @next/next.
//   2. eslint-plugin-better-tailwindcss — the design system's class rules,
//      evaluated against app/globals.css so a deleted scale is an unknown class.
//   3. Project rules — the route-segment-config ban, the import bans and the
//      component boundaries.
//
// Flat-config note carried from Phase 2: a later object that sets
// `no-restricted-syntax` or `no-restricted-imports` REPLACES the earlier
// options, so every selector and every banned path lives in one object each.

const aliasResolver = fileURLToPath(new URL('./web-alias-resolver.js', import.meta.url))

// A class may carry any number of `variant:` prefixes; every pattern below
// tolerates them so `md:ml-4` is judged like `ml-4`.
const VARIANTS = String.raw`^(?:[^\s:]+:)*`

const ROUTE_SEGMENT_CONFIGS = ['dynamic', 'revalidate', 'fetchCache', 'runtime', 'dynamicParams']

const FONT_GOOGLE = {
  name: 'next/font/google',
  message: 'Vazirmatn is vendored and loaded with next/font/local (foundation §7.2).',
}
const LUCIDE = {
  name: 'lucide-react',
  message:
    'Icons come from lib/icons.ts under semantic names — IconForward, not ChevronLeft (spec §8.2).',
}

// Layer 1. eslint-config-next's first object declares an `import/resolver`
// setting naming `eslint-import-resolver-typescript`, a package this
// workspace does not install; layer 3 declares its own resolver chain for the
// boundaries plugin, so that setting is dropped rather than merged. The babel
// parser it sets for JavaScript files is replaced below with typescript-eslint's,
// which parses the config files here without reaching into `next/dist`.
const nextLayer = nextCoreWebVitals.map((config) => {
  if (config.name !== 'next' || config.settings === undefined) return config
  const { react } = config.settings
  return { ...config, settings: { react } }
})

const javascriptParser = {
  files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
  languageOptions: { parser: tseslint.parser },
}

// Layer 2.
const RESTRICTED_CLASSES = [
  {
    pattern: String.raw`\[(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\()`,
    message: 'arbitrary-colour: only the tokens in app/globals.css carry colour (spec §5.1).',
  },
  {
    pattern: `${VARIANTS}-?tracking-`,
    message: 'tracking: letter-spacing is never set — connected letters tear apart (spec §6.3).',
  },
  {
    pattern: `${VARIANTS}leading-(?:none|tight)$`,
    message: 'leading: every size in the scale carries its own leading (spec §6.3).',
  },
  {
    pattern: `${VARIANTS}text-(?:left|right|justify)$`,
    message:
      'alignment: everything is start-aligned; centring is for empty states and the hero (spec §6.3).',
  },
  {
    pattern: `${VARIANTS}float-`,
    message: 'float: physical layout — use flex or grid with logical gaps (spec §11).',
  },
  {
    pattern: `${VARIANTS}rounded-(?:tl|tr|bl|br)(?:-|$)`,
    message: 'corners: physical corner radii — use rounded-ss, -se, -es, -ee (foundation §7.2).',
  },
  {
    pattern: `${VARIANTS}-?z-(?:\\d+|\\[)`,
    message: 'z-index: only z-header, z-overlay, z-sheet and z-toast exist (spec §5.4).',
  },
]

const tailwindLayer = {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: { 'better-tailwindcss': betterTailwindcss },
  settings: {
    // Relative to the package ESLint runs in — turbo and the regression suite
    // both run from apps/web.
    'better-tailwindcss': { entryPoint: 'app/globals.css' },
  },
  rules: {
    'better-tailwindcss/enforce-logical-properties': 'error',
    'better-tailwindcss/no-unknown-classes': 'error',
    'better-tailwindcss/no-conflicting-classes': 'error',
    'better-tailwindcss/no-duplicate-classes': 'error',
    'better-tailwindcss/no-restricted-classes': ['error', { restrict: RESTRICTED_CLASSES }],
  },
}

// Layer 3.
const routeSegmentConfigBan = {
  files: ['app/**/*.ts', 'app/**/*.tsx'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > Identifier.id[name=/^(?:${ROUTE_SEGMENT_CONFIGS.join('|')})$/]`,
        message:
          'route-segment-config: Cache Components and route segment configs express the same intent two incompatible ways (ADR-0006, spec §11).',
      },
    ],
  },
}

const importBans = {
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    'no-restricted-imports': ['error', { paths: [FONT_GOOGLE, LUCIDE] }],
  },
}

// The one file that may import lucide-react. The whole option object is
// restated on purpose (see the flat-config note above).
const iconsFile = {
  files: ['lib/icons.ts'],
  rules: {
    'no-restricted-imports': ['error', { paths: [FONT_GOOGLE] }],
  },
}

const boundariesLayer = {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: { boundaries },
  settings: {
    // Ours first for `@/`, the Node resolver for everything it declines.
    'import/resolver': {
      [aliasResolver]: {},
      node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    },
    // `mode: 'full'` matches the whole file path, so a file anywhere under
    // app/ is the `app` element and a file under components/ui/ is `ui`.
    'boundaries/elements': [
      { type: 'app', pattern: 'app/**/*', mode: 'full' },
      { type: 'ui', pattern: 'components/ui/**/*', mode: 'full' },
      { type: 'site', pattern: 'components/site/**/*', mode: 'full' },
      { type: 'lib', pattern: 'lib/**/*', mode: 'full' },
    ],
    'boundaries/files': [
      { category: 'test', pattern: '**/*.test.ts' },
      { category: 'test', pattern: '**/*.test.tsx' },
      { category: 'test', pattern: 'e2e/**/*.spec.ts' },
    ],
  },
  rules: {
    'boundaries/dependencies': [
      'error',
      {
        // Spec §4.3: `app` may import anything, so the default is allow and
        // the policies are the four exceptions. Each message opens with the
        // policy's name so the regression suite can assert the set exists.
        default: 'allow',
        policies: [
          {
            from: { element: { type: 'lib' } },
            disallow: { to: { element: { types: { anyOf: ['ui', 'site', 'app'] } } } },
            message:
              'lib-imports-packages-only: lib/** imports workspace packages and lib/** — never a component or a route (spec §4.3).',
          },
          {
            from: { element: { type: 'ui' } },
            disallow: { to: { element: { types: { anyOf: ['site', 'app'] } } } },
            message:
              'ui-imports-lib-only: components/ui/** imports lib/** and other primitives — never components/site/** or app/** (spec §4.3).',
          },
          {
            from: { element: { type: 'site' } },
            disallow: { to: { element: { type: 'app' } } },
            message:
              'site-never-imports-app: components/site/** composes ui/** and lib/** — never app/** (spec §4.3).',
          },
          {
            disallow: { to: { file: { categories: 'test' } } },
            message: 'no-test-imports: nothing imports a test file.',
          },
        ],
      },
    ],
  },
}

/** The layers that need no type information; apps/web/test/lint.test.ts lints with exactly these. */
export const webRules = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser: tseslint.parser },
  },
  tailwindLayer,
  routeSegmentConfigBan,
  importBans,
  iconsFile,
  boundariesLayer,
]

export default [...base, ...nextLayer, javascriptParser, ...webRules]
```

- [ ] **Step 6: Wire the app, Prettier and the manifest; delete the Phase 1 regex**

`apps/web/eslint.config.js`:

```js
// @ts-check
import next from '@ds/config-eslint/next'

export default [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...next,
]
```

Root `eslint.config.js` — `packages/config-eslint` has no `tsconfig.json`, so its new declaration file must not reach the type-aware base (the project service would report it as belonging to no project). Add it to the ignores:

```js
export default [
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      'packages/config-eslint/*.d.ts',
    ],
  },
  ...base,
]
```

`prettier.config.mjs` — the Phase 1 deferral closes; class order is Prettier's job so the lint rules never fight it:

```js
/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './apps/web/app/globals.css',
  tailwindFunctions: ['cn', 'cva'],
  overrides: [{ files: '*.md', options: { proseWrap: 'preserve' } }],
}
```

Root `package.json` `devDependencies` gains, in alphabetical position:

```json
    "prettier-plugin-tailwindcss": "catalog:",
```

Delete `packages/config-eslint/rtl.js` and `scripts/test-rtl-rule.sh` (`git rm`). In `scripts/check-docs.manifest`, replace the line `packages/config-eslint/rtl.js` with:

```
packages/config-eslint/next.d.ts
packages/config-eslint/web-alias-resolver.js
apps/web/eslint.config.js
```

- [ ] **Step 7: Install, run the suite, lint the tree, let Prettier sort**

Run: `pnpm install`
Expected: succeeds.

Run: `pnpm test --filter=web`
Expected: every case in `test/lint.test.ts` PASSES. If `enforce-logical-properties` does not flag a case the suite expects it to (`left-0`, `pl-2`), add that pattern to `RESTRICTED_CLASSES` with a `physical:` message rather than weakening the test, and say so in the task report.

Run: `pnpm lint`
Expected: green for every package. Web's own files are now linted by the three layers; fix any finding in the files, never by disabling a rule.

Run: `pnpm format`
Expected: the Tailwind plugin reorders classes in `apps/web/**/*.tsx`; there may be no changes yet. Commit whatever it changes.

- [ ] **Step 8: Verify and commit**

Run: `pnpm check`
Expected: green (`check:docs` now sees the manifest without `rtl.js`).

```bash
git add packages/config-eslint prettier.config.mjs package.json pnpm-lock.yaml eslint.config.js scripts/check-docs.manifest apps/web/eslint.config.js apps/web/test/lint.test.ts
git rm --quiet packages/config-eslint/rtl.js scripts/test-rtl-rule.sh
git add -u
git commit -m "feat(config): enforce the storefront design system with lint"
```

---

## Task 5: `lib/` — copy, icons, error messages, spring parameters

Spec §6.5 (copy), §8.2 (icons), §8.3 with foundation §7.6 (`lib/errors.ts`), §7.3 (`lib/motion.ts`), §10.1 (their tests).

**Files:**

- Create: `apps/web/lib/copy.ts`, `lib/icons.ts`, `lib/errors.ts`, `lib/motion.ts`
- Test: `apps/web/lib/copy.test.ts`, `lib/icons.test.tsx`, `lib/errors.test.ts`, `lib/motion.test.ts`

**Interfaces:**

- Consumes: `ERROR_CODES`, `ErrorCode` from `@ds/contracts`; `lucide-react`.
- Produces: `SITE_NAME: 'دبی ساپلیمنت'` and the `copy` tree (typed, `as const`) · `IconForward IconBack IconExternal IconSun IconMoon IconSystem IconClose IconCheck IconSpinner IconAlert IconEmpty` (each a lucide component), `ICON_SIZE = { sm: 16, md: 20, lg: 24 }`, `type Icon` · `errorMessage(code: string): string` and `FALLBACK_MESSAGE` · `SPRING`.

- [ ] **Step 1: Write the four failing tests**

`apps/web/lib/copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { copy, SITE_NAME } from './copy'

// Latin tokens that are allowed to appear in customer-facing copy. A brand
// name is Latin by definition (foundation §7.7 slugs); nothing else is.
const LATIN_ALLOWLIST: readonly string[] = ['MuscleTech']

function leaves(node: unknown, path: string): Array<[string, string]> {
  if (typeof node === 'string') return [[path, node]]
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, `${path}.${key}`))
  }
  throw new Error(`copy holds a non-string at ${path}`)
}

describe('lib/copy', () => {
  const strings = leaves(copy, 'copy')

  it('has strings at every leaf', () => {
    expect(strings.length).toBeGreaterThan(20)
    for (const [path, value] of strings) expect(value.trim(), path).not.toBe('')
  })

  it('carries no Latin letters or ASCII digits outside the allow-list (spec §6.4–§6.5)', () => {
    for (const [path, value] of strings) {
      let text = value
      for (const token of LATIN_ALLOWLIST) text = text.replaceAll(token, '')
      expect(text, path).not.toMatch(/[A-Za-z0-9]/)
    }
  })

  it('names the site once', () => {
    expect(copy.siteName).toBe(SITE_NAME)
    expect(SITE_NAME).toBe('دبی ساپلیمنت')
  })
})
```

`apps/web/lib/icons.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { ICON_SIZE, IconBack, IconForward, IconSpinner } from './icons'

function pathOf(element: ReactElement): string | null {
  const { container } = render(element)
  return container.querySelector('path')?.getAttribute('d') ?? null
}

describe('lib/icons', () => {
  it('IconForward points left — forward is left in a right-to-left store (spec §8.2)', () => {
    expect(pathOf(<IconForward />)).toBe('m15 18-6-6 6-6')
  })

  it('IconBack points right', () => {
    expect(pathOf(<IconBack />)).toBe('m9 18 6-6-6-6')
  })

  it('renders at the three sizes', () => {
    const { container } = render(<IconSpinner size={ICON_SIZE.lg} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '24')
    expect(ICON_SIZE).toEqual({ sm: 16, md: 20, lg: 24 })
  })
})
```

`apps/web/lib/errors.test.ts`:

```ts
import { ERROR_CODES } from '@ds/contracts'
import { describe, expect, it } from 'vitest'
import { errorMessage, FALLBACK_MESSAGE } from './errors'

describe('errorMessage', () => {
  it.each([...ERROR_CODES])('maps %s to a Persian sentence', (code) => {
    const message = errorMessage(code)
    expect(message).not.toBe(FALLBACK_MESSAGE)
    expect(message).not.toMatch(/[A-Za-z0-9]/)
    expect(message.length).toBeGreaterThan(10)
  })

  it('gives every code its own sentence', () => {
    const messages = ERROR_CODES.map((code) => errorMessage(code))
    expect(new Set(messages).size).toBe(ERROR_CODES.length)
  })

  it('falls back for an unknown or empty code', () => {
    expect(errorMessage('SOMETHING_NEW')).toBe(FALLBACK_MESSAGE)
    expect(errorMessage('')).toBe(FALLBACK_MESSAGE)
    expect(FALLBACK_MESSAGE).not.toMatch(/[A-Za-z0-9]/)
  })
})
```

`apps/web/lib/motion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SPRING } from './motion'

describe('SPRING (spec §7.3, apple-design §4)', () => {
  it('has no overshoot by default', () => {
    expect(SPRING.default).toEqual({ type: 'spring', bounce: 0, duration: 0.4 })
  })

  it('reserves bounce for momentum, and keeps it small', () => {
    expect(SPRING.momentum.bounce).toBe(0.2)
    expect(SPRING.sheet.bounce).toBe(0.2)
    expect(SPRING.sheet.duration).toBe(0.3)
  })

  it('never takes longer than Apple’s response of 0.4 s', () => {
    for (const spring of Object.values(SPRING)) expect(spring.duration).toBeLessThanOrEqual(0.4)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test --filter=web`
Expected: FAIL — four missing modules.

- [ ] **Step 3: Write `lib/copy.ts`**

```ts
// Every Persian string the storefront shows (spec §6.5). Components import a
// key, never a literal. Voice: formal شما, plain verbs, a call to action names
// what happens, an error says what went wrong and what to do next.

/** A placeholder until a real mark exists; one constant, used everywhere. */
export const SITE_NAME = 'دبی ساپلیمنت'

export const copy = {
  siteName: SITE_NAME,
  tagline: 'مکمل‌های ورزشی اصل، با ارسال به سراسر ایران',
  skipToContent: 'پرش به محتوا',
  nav: {
    primary: 'ناوبری اصلی',
    home: 'صفحهٔ اصلی',
    brands: 'برندها',
  },
  home: {
    headline: 'مکمل‌های ورزشی اصل، برای تمرین جدی',
    lead: 'پروتئین، کراتین و ویتامین‌ها از برندهای معتبر، با ضمانت اصالت و ارسال سریع.',
    cta: 'مشاهدهٔ برندها',
  },
  theme: {
    label: 'انتخاب طرح',
    light: 'روشن',
    dark: 'تاریک',
    system: 'سیستم',
  },
  footer: {
    rights: 'همهٔ حقوق محفوظ است',
  },
  actions: {
    retry: 'تلاش دوباره',
    backHome: 'بازگشت به صفحهٔ اصلی',
    addToCart: 'افزودن به سبد خرید',
    close: 'بستن',
  },
  errors: {
    title: 'مشکلی پیش آمد',
    body: 'لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، کمی بعد برگردید.',
    notFoundTitle: 'صفحه پیدا نشد',
    notFoundBody: 'نشانی را بررسی کنید یا به صفحهٔ اصلی برگردید.',
  },
  price: {
    discount: 'تخفیف',
    original: 'قیمت قبل',
  },
  design: {
    title: 'سیستم طراحی',
    intro: 'هر جزء در هر حالت، در طرح روشن و تاریک. جزئی که اینجا نیست، وجود ندارد.',
    panels: { light: 'طرح روشن', dark: 'طرح تاریک' },
    sections: {
      colors: 'رنگ‌ها',
      typography: 'تایپوگرافی',
      buttons: 'دکمه‌ها',
      links: 'پیوندها',
      surfaces: 'سطح‌ها',
      textFields: 'فیلدهای متنی',
      badges: 'نشان‌ها',
      skeletons: 'اسکلت‌ها',
      price: 'قیمت',
      emptyState: 'حالت خالی',
      themeToggle: 'تغییر طرح',
    },
    states: {
      default: 'عادی',
      disabled: 'غیرفعال',
      loading: 'در حال بارگذاری',
      error: 'خطا',
      withIcon: 'با آیکن',
      iconOnly: 'فقط آیکن',
      block: 'تمام‌عرض',
      withHint: 'با راهنما',
      inline: 'در متن',
    },
    samples: {
      heading: 'پروتئین وی ایزوله',
      paragraph:
        'مکمل‌های ورزشی وقتی نتیجه می‌دهند که اصل باشند و درست مصرف شوند. هر محصول در این فروشگاه با ضمانت اصالت عرضه می‌شود و برچسب مصرف آن به فارسی نوشته شده است.',
      brandSentence: 'پروتئین وی MuscleTech با طعم شکلات',
      label: 'شمارهٔ موبایل',
      hint: 'با ۰۹ شروع می‌شود',
      placeholder: '۰۹۱۲ ۳۴۵ ۶۷۸۹',
      error: 'شمارهٔ موبایل معتبر نیست',
      cardTitle: 'کراتین مونوهیدرات',
      cardBody: 'خالص، بدون طعم، ۳۰۰ گرم',
      badgeNew: 'جدید',
      badgeStock: 'موجود',
      badgeOut: 'ناموجود',
      emptyTitle: 'هنوز چیزی اینجا نیست',
      emptyBody: 'به‌زودی محصولات این بخش اضافه می‌شوند.',
      emptyAction: 'مشاهدهٔ همهٔ برندها',
      link: 'راهنمای مصرف',
      linkSentence: 'پیش از مصرف، این راهنما را بخوانید:',
    },
  },
} as const
```

- [ ] **Step 4: Write `lib/icons.ts`**

```ts
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Monitor,
  Moon,
  PackageOpen,
  Sun,
  X,
} from 'lucide-react'

// The only file that imports lucide-react (spec §8.2, enforced by lint).
// Names are semantic, and direction is decided here once: this store is
// right-to-left permanently (D3), so forward is left and back is right.
export const IconForward = ChevronLeft
export const IconBack = ChevronRight
export const IconExternal = ExternalLink
export const IconSun = Sun
export const IconMoon = Moon
export const IconSystem = Monitor
export const IconClose = X
export const IconCheck = Check
export const IconSpinner = LoaderCircle
export const IconAlert = CircleAlert
export const IconEmpty = PackageOpen

export type Icon = typeof Check

/** Icons render at 16, 20 or 24 px and nothing else. */
export const ICON_SIZE = { sm: 16, md: 20, lg: 24 } as const
export type IconSize = keyof typeof ICON_SIZE
```

- [ ] **Step 5: Write `lib/errors.ts`**

```ts
import { ERROR_CODES, type ErrorCode } from '@ds/contracts'

// Foundation §7.6 and spec §6.5: every code the API can emit has a Persian
// sentence that says what happened and what to do next; English never
// reaches a customer. The fallback covers a code this build does not know.
const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'اطلاعات واردشده درست نیست. موارد مشخص‌شده را اصلاح کنید.',
  UNAUTHORIZED: 'برای ادامه باید وارد حساب خود شوید.',
  FORBIDDEN: 'شما اجازهٔ دسترسی به این بخش را ندارید.',
  NOT_FOUND: 'چیزی که دنبال آن هستید پیدا نشد.',
  CONFLICT: 'این درخواست با وضعیت فعلی تداخل دارد. صفحه را تازه کنید و دوباره تلاش کنید.',
  RATE_LIMITED: 'تعداد درخواست‌ها بیش از حد است. کمی صبر کنید و دوباره تلاش کنید.',
  INTERNAL: 'مشکلی در سمت ما پیش آمد. دوباره تلاش کنید.',
  CATALOG_BRAND_NOT_FOUND: 'برند موردنظر پیدا نشد.',
  CATALOG_BRAND_SLUG_TAKEN: 'این نشانی برند قبلاً استفاده شده است.',
}

export const FALLBACK_MESSAGE = 'مشکلی پیش آمد. دوباره تلاش کنید.'

function isErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code)
}

export function errorMessage(code: string): string {
  return isErrorCode(code) ? MESSAGES[code] : FALLBACK_MESSAGE
}
```

- [ ] **Step 6: Write `lib/motion.ts`**

```ts
// Spec §7.3: Apple's spring values (apple-design skill §4) in Motion's
// `bounce` / `duration` form — bounce 0 is damping 1.0, duration is response.
// `motion` itself is installed by the first gesture surface, not here (D12).
export const SPRING = {
  /** damping 1.0, response 0.4 — no overshoot; the default for anything that moves. */
  default: { type: 'spring', bounce: 0, duration: 0.4 },
  /** ≈ damping 0.8 — only after a flick or a throw carried momentum. */
  momentum: { type: 'spring', bounce: 0.2, duration: 0.4 },
  /** Apple's drawer and sheet values. */
  sheet: { type: 'spring', bounce: 0.2, duration: 0.3 },
} as const
```

- [ ] **Step 7: Run the tests to verify they pass, then verify and commit**

Run: `pnpm test --filter=web`
Expected: PASS. If `IconForward`'s path differs from `m15 18-6-6 6-6`, lucide 1.34.0 draws its chevron differently: paste the actual `d` into the test **only after** confirming it is lucide's `chevron-left` (open `node_modules/lucide-react/dist/esm/icons/chevron-left.js`), and say so in the task report.

Run: `pnpm check`
Expected: green.

```bash
git add apps/web/lib
git commit -m "feat(web): add copy, icons, error messages and spring parameters"
```

---

## Task 6: Server primitives — Button, Link, Surface, Badge, Skeleton, Price, EmptyState

Spec §8.1 (the inventory and each primitive's states), §7.1 (press, hover, focus), §6.4 (digits through `@ds/persian`), §9 (≥ 44 px targets, `data-target`), §10.1 (the component tests). Review Focus 4 and 5. Deviations 3 and 8.

Every component here is a server component: no hooks, no `'use client'`. `Price` imports `server-only` so it can never be pulled into a client bundle with its Intl formatting.

**Files:**

- Create: `apps/web/components/ui/button.tsx`, `link.tsx`, `surface.tsx`, `badge.tsx`, `skeleton.tsx`, `price.tsx`, `empty-state.tsx`
- Test: `apps/web/components/ui/button.test.tsx`, `link.test.tsx`, `surface.test.tsx`, `badge.test.tsx`, `skeleton.test.tsx`, `price.test.tsx`, `empty-state.test.tsx`

**Interfaces:**

- Consumes: `cn` (Task 3); `copy`, icons, `ICON_SIZE` (Task 5); `formatToman`, `formatNumber` from `@ds/persian`.
- Produces:
  - `Button({ variant?: 'primary'|'secondary'|'ghost'|'destructive'|'link', size?: 'md'|'lg'|'icon', block?: boolean, loading?: boolean, icon?: ReactNode, ...ComponentProps<'button'> })` and `buttonVariants(opts)` (the class string, for links that look like buttons). Renders `data-target`, `data-variant`.
  - `Link({ variant?: 'text'|'plain', ...ComponentProps<typeof NextLink> })` and `linkVariants`.
  - `Surface({ variant?: 'default'|'raised'|'material'|'pressable', ...ComponentProps<'div'> })` and `surfaceVariants`.
  - `Badge({ variant?: 'inverted'|'outline'|'destructive', ...ComponentProps<'span'> })`.
  - `Skeleton({ shape?: 'block'|'line'|'circle', ...ComponentProps<'div'> })`, `SkeletonText({ lines?: number, className?: string })`.
  - `Price({ amountMinor: bigint, original?: bigint, className?: string })`.
  - `EmptyState({ title: string, description?: string, icon?: ReactNode, action?: ReactNode, as?: 'h1'|'h2', className?: string })`.

- [ ] **Step 1: Write the failing tests**

`apps/web/components/ui/button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'destructive', 'link'] as const)(
    'renders the %s variant as a marked target of type button',
    (variant) => {
      render(<Button variant={variant}>ادامه</Button>)
      const button = screen.getByRole('button', { name: 'ادامه' })
      expect(button).toHaveAttribute('data-variant', variant)
      expect(button).toHaveAttribute('data-target')
      expect(button).toHaveAttribute('type', 'button')
    },
  )

  it('is secondary by default — primary is a choice, one per view (spec §9)', () => {
    render(<Button>ادامه</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'secondary')
  })

  it.each([
    ['md', 'min-h-11'],
    ['lg', 'min-h-12'],
    ['icon', 'size-11'],
  ] as const)('the %s size is at least 44 px', (size, className) => {
    render(
      <Button size={size} aria-label="بستن">
        ×
      </Button>,
    )
    expect(screen.getByRole('button')).toHaveClass(className)
  })

  it('keeps the label, stays focusable and swallows clicks while loading (Review Focus 5)', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        ثبت سفارش
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'ثبت سفارش' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).not.toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('replaces the icon with the spinner while loading, and restores it after', () => {
    const { rerender, container } = render(
      <Button loading icon={<svg data-testid="icon" />}>
        ادامه
      </Button>,
    )
    expect(screen.queryByTestId('icon')).toBeNull()
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    rerender(<Button icon={<svg data-testid="icon" />}>ادامه</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeNull()
  })

  it('without an icon, keeps the label in the document at opacity 0 under the spinner', () => {
    const { container } = render(<Button loading>ادامه</Button>)
    expect(screen.getByRole('button', { name: 'ادامه' })).toBeInTheDocument()
    expect(screen.getByText('ادامه')).toHaveClass('opacity-0')
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('passes disabled through', () => {
    render(<Button disabled>ادامه</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

`apps/web/components/ui/link.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Link } from './link'

describe('Link', () => {
  it('is underlined by default so colour is never the only cue', () => {
    render(<Link href="/brands">برندها</Link>)
    const link = screen.getByRole('link', { name: 'برندها' })
    expect(link).toHaveAttribute('href', '/brands')
    expect(link).toHaveClass('underline')
  })

  it('the plain variant carries no underline and merges the caller’s classes', () => {
    render(
      <Link href="/" variant="plain" className="min-h-11">
        خانه
      </Link>,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveClass('no-underline')
    expect(link).toHaveClass('min-h-11')
    expect(link).not.toHaveClass('underline')
  })
})
```

`apps/web/components/ui/surface.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Surface, surfaceVariants } from './surface'

describe('Surface', () => {
  it('is a bordered card by default', () => {
    const { container } = render(<Surface>محتوا</Surface>)
    expect(container.firstChild).toHaveClass('border', 'bg-card', 'rounded-lg')
  })

  it.each([
    ['raised', 'shadow-sm'],
    ['material', 'material'],
    ['pressable', 'press'],
  ] as const)('the %s variant carries %s', (variant, className) => {
    expect(surfaceVariants({ variant })).toContain(className)
  })
})
```

`apps/web/components/ui/badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './badge'

describe('Badge', () => {
  it.each([
    ['inverted', 'bg-foreground'],
    ['outline', 'border-input'],
    ['destructive', 'bg-destructive'],
  ] as const)('the %s variant carries %s at caption size, weight 600', (variant, className) => {
    render(<Badge variant={variant}>جدید</Badge>)
    const badge = screen.getByText('جدید')
    expect(badge).toHaveClass(className, 'text-caption', 'font-semibold')
  })
})
```

`apps/web/components/ui/skeleton.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton, SkeletonText } from './skeleton'

describe('Skeleton', () => {
  it('is hidden from assistive technology and shimmers', () => {
    const { container } = render(<Skeleton className="h-8" />)
    const skeleton = container.firstChild
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(skeleton).toHaveClass('skeleton')
  })

  it('a circle is fully rounded', () => {
    const { container } = render(<Skeleton shape="circle" className="size-12" />)
    expect(container.firstChild).toHaveClass('rounded-full')
  })

  it('SkeletonText renders the requested number of lines, the last one shorter', () => {
    const { container } = render(<SkeletonText lines={4} />)
    const lines = container.querySelectorAll('.skeleton')
    expect(lines).toHaveLength(4)
    expect(lines[3]).toHaveClass('w-3/4')
  })
})
```

`apps/web/components/ui/price.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Price } from './price'

describe('Price', () => {
  it('formats toman in Persian digits and never emits an ASCII digit (spec §6.4)', () => {
    const { container } = render(<Price amountMinor={28_500_000n} />)
    expect(container.textContent).toContain('۲٬۸۵۰٬۰۰۰ تومان')
    expect(container.textContent).not.toMatch(/[0-9]/)
    expect(container.querySelector('s')).toBeNull()
  })

  it('strikes the original and shows a truncated discount', () => {
    const { container } = render(<Price amountMinor={20_000_000n} original={30_000_000n} />)
    expect(container.querySelector('s')?.textContent).toContain('۳٬۰۰۰٬۰۰۰ تومان')
    expect(container.textContent).toContain('۳۳٪')
    expect(container.textContent).toContain('تخفیف')
    expect(container.textContent).not.toMatch(/[0-9]/)
  })

  it.each([
    ['equal', 28_500_000n],
    ['lower', 20_000_000n],
  ])('shows no discount when the original is %s (Review Focus 4)', (_label, original) => {
    const { container } = render(<Price amountMinor={28_500_000n} original={original} />)
    expect(container.querySelector('s')).toBeNull()
    expect(container.textContent).not.toContain('تخفیف')
    expect(container.textContent).not.toContain('٪')
  })

  it('aligns digits in columns', () => {
    const { container } = render(<Price amountMinor={1n} />)
    expect(container.firstChild).toHaveClass('tabular-nums')
  })
})
```

`apps/web/components/ui/empty-state.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders a level-2 heading by default with the description and the action', () => {
    render(
      <EmptyState
        title="هنوز چیزی اینجا نیست"
        description="به‌زودی"
        action={<button type="button">بازگشت</button>}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'هنوز چیزی اینجا نیست' }),
    ).toBeInTheDocument()
    expect(screen.getByText('به‌زودی')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'بازگشت' })).toBeInTheDocument()
  })

  it('can be the page’s h1', () => {
    render(<EmptyState as="h1" title="صفحه پیدا نشد" />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('hides a decorative icon from assistive technology', () => {
    const { container } = render(<EmptyState title="خالی" icon={<svg data-testid="icon" />} />)
    expect(container.querySelector('[aria-hidden="true"] [data-testid="icon"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test --filter=web`
Expected: FAIL — seven missing modules.

- [ ] **Step 3: Write `button.tsx`**

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import { ICON_SIZE, IconSpinner } from '@/lib/icons'
import { cn } from '@/lib/utils'

// Spec §8.1. `primary` is the only filled variant. Its `--input` edge is what
// light mode needs (Frozen on paper is 1.87:1, §5.2); in dark mode the same
// edge composites to Frozen over Frozen and vanishes, so no `dark:` variant is
// needed — which also keeps the gallery's forced panels honest (Task 9).
// Sizes start at 44 px — nothing smaller exists (§9, Fitts).
export const buttonVariants = cva(
  'relative inline-flex press items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap focus-ring select-none disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'border border-input bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-foreground underline decoration-1 underline-offset-3 hover:text-muted-foreground',
      },
      size: {
        md: 'min-h-11 px-4 text-body',
        lg: 'min-h-12 px-6 text-body',
        icon: 'size-11',
      },
      block: {
        true: 'flex w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md', block: false },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Keeps the label and the focus, swallows clicks, shows the spinner (spec §8.1). */
    loading?: boolean
    /** A leading icon; the spinner takes its place while loading. */
    icon?: ReactNode
  }

function swallow(event: MouseEvent<HTMLButtonElement>) {
  // Belt and braces with `aria-busy:pointer-events-none`: a submit button
  // that is already submitting must not submit twice (Review Focus 5).
  event.preventDefault()
}

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  icon,
  type = 'button',
  onClick,
  children,
  ...props
}: ButtonProps) {
  const hasIcon = icon !== undefined && icon !== null
  return (
    <button
      type={type}
      data-target=""
      data-variant={variant ?? 'secondary'}
      aria-busy={loading || undefined}
      onClick={loading ? swallow : onClick}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {hasIcon ? (
        <span
          className="inline-flex size-5 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {loading ? <IconSpinner className="animate-spin" size={ICON_SIZE.md} /> : icon}
        </span>
      ) : null}
      <span className={cn(loading && !hasIcon && 'opacity-0')}>{children}</span>
      {loading && !hasIcon ? (
        <span
          className="absolute inset-0 inline-flex items-center justify-center"
          aria-hidden="true"
        >
          <IconSpinner className="animate-spin" size={ICON_SIZE.md} />
        </span>
      ) : null}
    </button>
  )
}
```

- [ ] **Step 4: Write `link.tsx`**

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import NextLink from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1: a text link is always underlined — 1 px, 3 px off the baseline —
// so it is distinguishable without colour. `plain` is for links that look like
// something else: a button (`buttonVariants`), a whole card (`surfaceVariants`),
// the wordmark.
export const linkVariants = cva('rounded-sm focus-ring', {
  variants: {
    variant: {
      text: 'text-foreground underline decoration-1 underline-offset-3 transition-colors duration-(--duration-quick) ease-out hover:text-muted-foreground',
      plain: 'no-underline',
    },
  },
  defaultVariants: { variant: 'text' },
})

export type LinkProps = ComponentProps<typeof NextLink> & VariantProps<typeof linkVariants>

export function Link({ className, variant, ...props }: LinkProps) {
  return <NextLink className={cn(linkVariants({ variant }), className)} {...props} />
}
```

- [ ] **Step 5: Write `surface.tsx`**

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1. `material` is floating chrome only (§5.5) — never two stacked.
// `pressable` is a whole-card link: use it on a `Link variant="plain"`.
export const surfaceVariants = cva('rounded-lg text-card-foreground', {
  variants: {
    variant: {
      default: 'border bg-card',
      raised:
        'bg-card shadow-sm transition-shadow duration-(--duration-quick) ease-out hover:shadow-md',
      material: 'material text-foreground',
      pressable: 'block press border bg-card focus-ring hover:bg-accent',
    },
  },
  defaultVariants: { variant: 'default' },
})

export type SurfaceProps = ComponentProps<'div'> & VariantProps<typeof surfaceVariants>

export function Surface({ className, variant, ...props }: SurfaceProps) {
  return <div className={cn(surfaceVariants({ variant }), className)} {...props} />
}
```

- [ ] **Step 6: Write `badge.tsx`**

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1. `inverted` is the Von Restorff chip — Iris on light, Frozen on
// dark, because it is `--foreground` on `--background` — reserved for the one
// thing to notice in a view (§9).
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        inverted: 'bg-foreground text-background',
        outline: 'border border-input text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
)

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
```

- [ ] **Step 7: Write `skeleton.tsx`**

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1. Decorative: hidden from assistive technology; the `skeleton`
// utility shimmers at 0.6 Hz and goes static under reduced motion (§7.2, §7.4).
export type SkeletonProps = ComponentProps<'div'> & { shape?: 'block' | 'line' | 'circle' }

export function Skeleton({ className, shape = 'block', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton',
        shape === 'circle' ? 'rounded-full' : 'rounded-sm',
        shape === 'line' && 'h-4 w-full',
        className,
      )}
      {...props}
    />
  )
}

/** A paragraph-shaped fallback for a Suspense island. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} shape="line" className={index === lines - 1 ? 'w-3/4' : undefined} />
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Write `price.tsx`**

```tsx
import 'server-only'
import { formatNumber, formatToman } from '@ds/persian'
import { Badge } from '@/components/ui/badge'
import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'

// Spec §8.1 and §6.4: a raw number cannot reach the page through this
// component. `server-only` keeps the Intl formatting on the server (§7.3).
export type PriceProps = {
  /** IRR minor units — rials — as everywhere in the system. */
  amountMinor: bigint
  /** The pre-discount amount; ignored unless it is higher than `amountMinor`. */
  original?: bigint
  className?: string
}

export function Price({ amountMinor, original, className }: PriceProps) {
  const discounted = original !== undefined && original > amountMinor
  // Integer division truncates on purpose: never promise more than is given.
  const percent = discounted ? ((original - amountMinor) * 100n) / original : 0n

  return (
    <span
      className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums', className)}
    >
      <span className="text-title font-bold text-foreground">{formatToman(amountMinor)}</span>
      {discounted ? (
        <>
          <s className="text-small text-muted-foreground">
            <span className="sr-only">{copy.price.original}: </span>
            {formatToman(original)}
          </s>
          <Badge variant="inverted">
            {formatNumber(percent)}٪ {copy.price.discount}
          </Badge>
        </>
      ) : null}
    </span>
  )
}
```

The percent sign is «٪» (U+066A), the Persian form, placed after the number as Persian typography sets it.

- [ ] **Step 9: Write `empty-state.tsx`**

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1: icon slot, title, one line, one action; centred — one of the two
// places centring is allowed (§6.3). `as="h1"` when it is the page.
export type EmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  as?: 'h1' | 'h2'
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  as: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4 py-12 text-center', className)}>
      {icon ? (
        <div className="text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <Heading className="text-title font-bold">{title}</Heading>
      {description ? <p className="text-body text-muted-foreground prose">{description}</p> : null}
      {action}
    </div>
  )
}
```

- [ ] **Step 10: Run the tests to verify they pass, lint, and commit**

Run: `pnpm test --filter=web`
Expected: PASS. If `next/link` complains about a missing router context under jsdom, add `vi.mock('next/link', () => ({ default: (props: React.ComponentProps<'a'>) => <a {...props} /> }))` to `link.test.tsx` only, and say so in the task report.

Run: `pnpm lint --filter=web`
Expected: green — every class in these files is known to `app/globals.css`; `no-unknown-classes` is the proof that no primitive reaches outside the tokens.

Run: `pnpm check`
Expected: green.

```bash
git add apps/web/components/ui
git commit -m "feat(web): add the server-rendered primitives"
```

---

## Task 7: Client primitives — TextField, ThemeToggle, Providers

Spec §8.1 (TextField, ThemeToggle — "deliberately the first portal component"), §5.6 (theme switching, the View Transitions cross-fade), §7.1 (overlays materialise from their trigger), §4.4 (`'use client'` only where Base UI or the theme requires it). Deviation 2.

**Files:**

- Create: `apps/web/components/ui/text-field.tsx`, `apps/web/components/site/theme-toggle.tsx`, `apps/web/components/site/providers.tsx`
- Modify: `apps/web/test/setup.ts` (two jsdom stubs)
- Test: `apps/web/components/ui/text-field.test.tsx`, `apps/web/components/site/theme-toggle.test.tsx`

**Interfaces:**

- Consumes: `buttonVariants`, `cn`, `copy`, icons (Tasks 3, 5, 6); `@base-ui/react/field`, `@base-ui/react/menu`, `@base-ui/react/direction-provider`; `next-themes`.
- Produces: `TextField({ label, hint?, error?, className?, ...input props })` — 48 px, 16 px text, `data-target`, error wired through `aria-describedby` and `aria-invalid` · `ThemeToggle({ className? })` — a Base UI Menu with three radio items, closes on choice, cross-fades the theme · `Providers({ children })` — `ThemeProvider` + `DirectionProvider`, the one client wrapper the layout renders.

- [ ] **Step 1: Stub what jsdom lacks**

Append to `apps/web/test/setup.ts`:

```ts
// jsdom has neither. next-themes reads matchMedia for `enableSystem`; Base UI's
// positioning observes element sizes. Both stubs are inert, and both are
// installed only when absent so a future jsdom that ships them wins.
if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  })
}
if (!('ResizeObserver' in window)) {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
}
```

- [ ] **Step 2: Write the failing tests**

`apps/web/components/ui/text-field.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextField } from './text-field'

describe('TextField', () => {
  it('associates the label and describes the input by its hint', () => {
    render(<TextField label="شمارهٔ موبایل" hint="با ۰۹ شروع می‌شود" />)
    const input = screen.getByLabelText('شمارهٔ موبایل')
    const hint = screen.getByText('با ۰۹ شروع می‌شود')
    expect(hint.id).not.toBe('')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(hint.id)
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('an error marks the input invalid and is announced with the hint', () => {
    render(<TextField label="شمارهٔ موبایل" hint="راهنما" error="شمارهٔ موبایل معتبر نیست" />)
    const input = screen.getByLabelText('شمارهٔ موبایل')
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(ids).toContain(screen.getByText('شمارهٔ موبایل معتبر نیست').id)
    expect(ids).toContain(screen.getByText('راهنما').id)
  })

  it('is 48 px tall, 16 px text, with the control boundary, and a marked target', () => {
    render(<TextField label="نام" />)
    const input = screen.getByLabelText('نام')
    expect(input).toHaveClass('min-h-12', 'text-body', 'border-input')
    expect(input).toHaveAttribute('data-target')
  })

  it('passes inputMode and disabled through', () => {
    render(<TextField label="کد پستی" inputMode="numeric" disabled />)
    const input = screen.getByLabelText('کد پستی')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toBeDisabled()
  })
})
```

`apps/web/components/site/theme-toggle.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './theme-toggle'

function renderToggle() {
  return render(
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem storageKey="ds-theme">
      <ThemeToggle />
    </ThemeProvider>,
  )
}

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('is a labelled, marked, 44 px trigger that opens a menu', () => {
    renderToggle()
    const trigger = screen.getByRole('button', { name: 'انتخاب طرح' })
    expect(trigger).toHaveAttribute('data-target')
    expect(trigger).toHaveClass('size-11')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('offers exactly the three themes as radio items and applies the choice', async () => {
    renderToggle()
    await userEvent.click(screen.getByRole('button', { name: 'انتخاب طرح' }))
    const items = await screen.findAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent?.trim())).toEqual(['روشن', 'تاریک', 'سیستم'])
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'تاریک' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem('ds-theme')).toBe('dark')
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test --filter=web`
Expected: FAIL — two missing modules.

- [ ] **Step 4: Write `text-field.tsx`**

```tsx
'use client'

import { Field } from '@base-ui/react/field'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1. Base UI's Field wires label, hint and error to the control
// (`aria-describedby`, `aria-invalid`, `data-invalid`); this file adds the
// tokens. 48 px tall with 16 px text — iOS Safari zooms into anything smaller
// (§6.2). Label above, start-aligned; the error replaces nothing, it is added.
export type TextFieldProps = Omit<ComponentProps<typeof Field.Control>, 'className' | 'render'> & {
  label: string
  hint?: string
  error?: string
  /** Applied to the field's root, not to the input. */
  className?: string
}

export function TextField({ label, hint, error, className, disabled, ...control }: TextFieldProps) {
  const invalid = error !== undefined && error !== ''
  return (
    <Field.Root
      className={cn('flex flex-col gap-2', className)}
      invalid={invalid}
      disabled={disabled}
    >
      <Field.Label className="text-small font-medium text-foreground">{label}</Field.Label>
      <Field.Control
        data-target=""
        className="min-h-12 rounded-md border border-input bg-card px-3 text-body text-foreground focus-ring transition-colors duration-(--duration-quick) ease-out placeholder:text-muted-foreground data-disabled:opacity-50 data-invalid:border-destructive"
        {...control}
      />
      {hint ? (
        <Field.Description className="text-small text-muted-foreground">{hint}</Field.Description>
      ) : null}
      {invalid ? (
        <Field.Error match className="text-small text-destructive">
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  )
}
```

- [ ] **Step 5: Write `theme-toggle.tsx`**

```tsx
'use client'

import { Menu } from '@base-ui/react/menu'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { buttonVariants } from '@/components/ui/button'
import { copy } from '@/lib/copy'
import { ICON_SIZE, IconCheck, IconMoon, IconSun, IconSystem } from '@/lib/icons'
import { cn } from '@/lib/utils'

// Spec §8.1 and §5.6. The first portal component: its popup is rendered into
// <body> and inherits `dir="rtl"` from <html>, which the e2e suite asserts.
// The switch is one whole-page cross-fade through the View Transitions API
// where it exists, instant elsewhere and under reduced motion.

const THEMES = ['light', 'dark', 'system'] as const
type Theme = (typeof THEMES)[number]

const ICONS = { light: IconSun, dark: IconMoon, system: IconSystem } as const
const LABELS = {
  light: copy.theme.light,
  dark: copy.theme.dark,
  system: copy.theme.system,
} as const

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

const subscribeToNothing = () => () => undefined
/** false during server rendering and hydration, true after — without a state setter in an effect. */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  // Before hydration the stored theme is unknown; the trigger shows the
  // system icon until it is, so the server and the client render the same thing.
  const current: Theme = mounted && isTheme(theme) ? theme : 'system'
  const Icon = mounted ? ICONS[current] : IconSystem

  function choose(next: Theme) {
    if (next === current) return
    if (!('startViewTransition' in document) || prefersReducedMotion()) {
      setTheme(next)
      return
    }
    // flushSync commits the attribute inside the transition's callback, so the
    // old and new snapshots differ by exactly the theme.
    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(next)
      })
    })
  }

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        data-target=""
        aria-label={copy.theme.label}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), className)}
      >
        <Icon size={ICON_SIZE.md} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-overlay">
          <Menu.Popup className="min-w-40 popup rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            <Menu.RadioGroup
              value={current}
              onValueChange={(value) => {
                if (isTheme(value)) choose(value)
              }}
            >
              {THEMES.map((option) => {
                const OptionIcon = ICONS[option]
                return (
                  <Menu.RadioItem
                    key={option}
                    value={option}
                    closeOnClick
                    data-target=""
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-body outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <OptionIcon size={ICON_SIZE.sm} aria-hidden="true" />
                    <span className="grow">{LABELS[option]}</span>
                    <Menu.RadioItemIndicator>
                      <IconCheck size={ICON_SIZE.sm} aria-hidden="true" />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                )
              })}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
```

- [ ] **Step 6: Write `providers.tsx`**

```tsx
'use client'

import { DirectionProvider } from '@base-ui/react/direction-provider'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

// Spec §5.6. The pre-paint script next-themes injects sets `data-theme`
// before React hydrates, which keeps the shell static (no cookies in a
// layout) and the first paint in the right theme. `disableTransitionOnChange`
// stops every element cross-fading on its own — the View Transition does it
// for the whole page at once. Light is what renders when nothing is stored.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      storageKey="ds-theme"
    >
      <DirectionProvider direction="rtl">{children}</DirectionProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 7: Run the tests, then build**

Run: `pnpm test --filter=web`
Expected: PASS. If Base UI's menu cannot be opened under jsdom (an error naming a layout API), keep the first ThemeToggle test, replace the second with a render-only assertion that the trigger and the three labels' copy keys exist, and say so in the task report — the interaction is proven by Task 11's e2e suite either way.

Run: `API_INTERNAL_URL=http://127.0.0.1:9 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm build --filter=web`
Expected: succeeds — the first Base UI primitives compile under `reactCompiler: true` (spec §16 risk). If the compiler rejects a render prop, add `'use no memo'` to that file only and record it.

Run: `pnpm check`
Expected: green.

```bash
git add apps/web/components apps/web/test/setup.ts
git commit -m "feat(web): add the text field and the theme toggle"
```

---

## Task 8: The shell — wordmark, header, footer, layout, home, and the error pages

Spec §4.2 (the layout tree), §8.1 (Header, Footer), §8.3 (error pages), §9 (skip link, landmarks, one h1, one primary action), foundation §7.6–§7.7 (error files, `metadataBase`, `openGraph.locale`). Deviations 2 and 4.

**Files:**

- Create: `apps/web/components/site/wordmark.tsx`, `header.tsx`, `footer.tsx`; `apps/web/app/error.tsx`, `not-found.tsx`, `global-error.tsx`
- Replace: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`
- Modify: `apps/web/lib/errors.ts` (+ `describeError`)
- Test: `apps/web/components/site/header.test.tsx`, `footer.test.tsx`; `apps/web/app/page.test.tsx`, `not-found.test.tsx`, `error.test.tsx`; `apps/web/lib/errors.test.ts` (append)

**Interfaces:**

- Consumes: every primitive (Tasks 6–7), `copy`, `siteUrl`, `vazirmatn`, `formatJalaliYear`.
- Produces: `Wordmark({ className? })` · `Header()` · `Footer({ year: ReactNode })` · `describeError(error: unknown): string` · the root layout every route renders inside, with `<main id="main">`.

- [ ] **Step 1: Write the failing tests**

`apps/web/components/site/header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Header } from './header'

describe('Header', () => {
  it('is a sticky material banner with the wordmark first and the toggle last', () => {
    render(<Header />)
    const banner = screen.getByRole('banner')
    expect(banner).toHaveClass('material', 'sticky', 'z-header')
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('دبی ساپلیمنت')
    expect(links[0]).toHaveAttribute('href', '/')
    expect(screen.getByRole('navigation', { name: 'ناوبری اصلی' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'برندها' })).toHaveAttribute('href', '/brands')
    expect(screen.getByRole('button', { name: 'انتخاب طرح' })).toBeInTheDocument()
  })

  it('keeps the navigation under seven items (spec §9, Hick)', () => {
    render(<Header />)
    const nav = screen.getByRole('navigation')
    expect(nav.querySelectorAll('a, button').length).toBeLessThanOrEqual(7)
  })
})
```

`apps/web/components/site/footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer } from './footer'

describe('Footer', () => {
  it('is a contentinfo landmark carrying the year it is given', () => {
    render(<Footer year="۱۴۰۵" />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('۱۴۰۵')
    expect(footer).toHaveTextContent('همهٔ حقوق محفوظ است')
    expect(footer.textContent).not.toMatch(/[0-9]/)
  })
})
```

`apps/web/app/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from './page'

describe('/', () => {
  it('has one h1 and exactly one primary action', () => {
    const { container } = render(<HomePage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
  })
})
```

`apps/web/app/not-found.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotFound from './not-found'

describe('not-found', () => {
  it('says what happened and offers the way home', () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { level: 1, name: 'صفحه پیدا نشد' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'بازگشت به صفحهٔ اصلی' })).toHaveAttribute('href', '/')
  })
})
```

`apps/web/app/error.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ErrorPage from './error'

describe('error', () => {
  it('shows the mapped message for a coded error and retries', async () => {
    const reset = vi.fn()
    const error = Object.assign(new Error('boom'), { code: 'RATE_LIMITED' })
    render(<ErrorPage error={error} reset={reset} />)
    expect(screen.getByRole('heading', { level: 1, name: 'مشکلی پیش آمد' })).toBeInTheDocument()
    expect(screen.getByText(/تعداد درخواست‌ها/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('never shows an English message', () => {
    render(<ErrorPage error={new Error('ECONNREFUSED 127.0.0.1:9')} reset={() => undefined} />)
    expect(document.body.textContent).not.toMatch(/[A-Za-z]/)
  })
})
```

Append to `apps/web/lib/errors.test.ts`:

```ts
describe('describeError', () => {
  it('uses the code when the error carries one', () => {
    expect(describeError({ code: 'NOT_FOUND' })).toBe(errorMessage('NOT_FOUND'))
  })

  it('uses the generic body for anything else', () => {
    expect(describeError(new Error('ECONNREFUSED'))).toBe(copy.errors.body)
    expect(describeError(null)).toBe(copy.errors.body)
    expect(describeError({ code: 42 })).toBe(copy.errors.body)
  })
})
```

Add `describeError` and `import { copy } from './copy'` to that file's imports.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test --filter=web`
Expected: FAIL — missing modules and the missing `describeError`.

- [ ] **Step 3: Extend `lib/errors.ts`**

Append:

```ts
import { copy } from './copy'

/** The sentence an error boundary shows: the code's message if the error carries one, else the generic body. */
export function describeError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return errorMessage(error.code)
  }
  return copy.errors.body
}
```

(Move the `import` to the top of the file with the others.)

- [ ] **Step 4: Write the three site components**

`apps/web/components/site/wordmark.tsx`:

```tsx
import { Link } from '@/components/ui/link'
import { SITE_NAME } from '@/lib/copy'
import { cn } from '@/lib/utils'

// Spec §6.5: a typeset placeholder until a real mark exists — weight 800, the
// site name, a link home. Its visible text is its accessible name.
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      variant="plain"
      href="/"
      data-target=""
      className={cn(
        'inline-flex min-h-11 items-center text-title font-extrabold text-foreground',
        className,
      )}
    >
      {SITE_NAME}
    </Link>
  )
}
```

`apps/web/components/site/header.tsx`:

```tsx
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { copy } from '@/lib/copy'
import { ThemeToggle } from './theme-toggle'
import { Wordmark } from './wordmark'

// Spec §8.1: the material, sticky; wordmark at the start, one link, the
// toggle at the end. «برندها» targets a route 3c creates; until then it is
// the not-found page, and nothing is deployed before Phase 4.
export function Header() {
  return (
    <header className="sticky top-0 z-header material">
      <div className="container-page flex min-h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav aria-label={copy.nav.primary} className="flex items-center gap-2">
          <Link
            variant="plain"
            href="/brands"
            data-target=""
            className={buttonVariants({ variant: 'ghost' })}
          >
            {copy.nav.brands}
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
```

`apps/web/components/site/footer.tsx`:

```tsx
import type { ReactNode } from 'react'
import { copy } from '@/lib/copy'
import { Wordmark } from './wordmark'

// Spec §8.1. The year arrives from the layout, computed inside 'use cache'.
export function Footer({ year }: { year: ReactNode }) {
  return (
    <footer className="border-t">
      <div className="container-page flex flex-col gap-4 py-8 text-small text-muted-foreground md:flex-row md:items-center md:justify-between">
        <Wordmark className="text-title-sm" />
        <p>
          {copy.siteName} © {year} · {copy.footer.rights}
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 5: Write the layout and the home page**

`apps/web/app/layout.tsx`:

```tsx
import { formatJalaliYear } from '@ds/persian'
import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import type { ReactNode } from 'react'
import { Footer } from '@/components/site/footer'
import { Header } from '@/components/site/header'
import { Providers } from '@/components/site/providers'
import { copy, SITE_NAME } from '@/lib/copy'
import { siteUrl } from '@/lib/site'
import { vazirmatn } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: copy.tagline,
  openGraph: { type: 'website', locale: 'fa_IR', siteName: SITE_NAME },
}

// Cache Components reject `new Date()` in a prerendered component. Inside
// 'use cache' it is the entry's creation time, refreshed daily — which is
// exactly what a copyright year is.
async function CopyrightYear() {
  'use cache'
  cacheLife('days')
  return formatJalaliYear(new Date())
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-toast focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            {copy.skipToContent}
          </a>
          <Header />
          <main id="main" tabIndex={-1} className="container-page grow py-8">
            {children}
          </main>
          <Footer year={<CopyrightYear />} />
        </Providers>
      </body>
    </html>
  )
}
```

`apps/web/app/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { copy, SITE_NAME } from '@/lib/copy'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
}

// The one view that may centre (§6.3) and, like every view, has exactly one
// primary action (§9). The CTA is full-width on a phone and last in its group.
export default function HomePage() {
  return (
    <section className="flex flex-col items-start gap-6 py-8">
      <h1 className="text-display font-extrabold prose">{copy.home.headline}</h1>
      <p className="text-lead text-muted-foreground prose">{copy.home.lead}</p>
      <Link
        variant="plain"
        href="/brands"
        data-target=""
        className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full sm:w-auto')}
      >
        {copy.home.cta}
      </Link>
    </section>
  )
}
```

- [ ] **Step 6: Write the three error files**

`apps/web/app/error.tsx` — Next.js requires a client component here (Deviation 2):

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { copy } from '@/lib/copy'
import { describeError } from '@/lib/errors'
import { ICON_SIZE, IconAlert } from '@/lib/icons'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <EmptyState
      as="h1"
      icon={<IconAlert size={ICON_SIZE.lg} />}
      title={copy.errors.title}
      description={describeError(error)}
      action={
        <Button variant="primary" onClick={reset}>
          {copy.actions.retry}
        </Button>
      }
    />
  )
}
```

`apps/web/app/not-found.tsx` — a server component; Next.js injects `<meta name="robots" content="noindex">` for every 404 response, which Task 11 asserts:

```tsx
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Link } from '@/components/ui/link'
import { copy } from '@/lib/copy'
import { ICON_SIZE, IconEmpty } from '@/lib/icons'

export default function NotFound() {
  return (
    <EmptyState
      as="h1"
      icon={<IconEmpty size={ICON_SIZE.lg} />}
      title={copy.errors.notFoundTitle}
      description={copy.errors.notFoundBody}
      action={
        <Link
          variant="plain"
          href="/"
          data-target=""
          className={buttonVariants({ variant: 'primary' })}
        >
          {copy.actions.backHome}
        </Link>
      }
    />
  )
}
```

`apps/web/app/global-error.tsx` — replaces the root layout when the layout itself fails, so it carries its own `<html>`, the font and the stylesheet:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { copy } from '@/lib/copy'
import { describeError } from '@/lib/errors'
import { ICON_SIZE, IconAlert } from '@/lib/icons'
import { vazirmatn } from './fonts'
import './globals.css'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="flex min-h-dvh flex-col">
        <main className="container-page grow py-8">
          <EmptyState
            as="h1"
            icon={<IconAlert size={ICON_SIZE.lg} />}
            title={copy.errors.title}
            description={describeError(error)}
            action={
              <Button variant="primary" onClick={reset}>
                {copy.actions.retry}
              </Button>
            }
          />
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Run the tests, build, and look**

Run: `pnpm test --filter=web`
Expected: PASS.

Run: `API_INTERNAL_URL=http://127.0.0.1:9 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm build --filter=web`
Expected: succeeds; `/` is static (the `'use cache'` year is part of the shell); the build output lists `/_not-found` as static too. A "used `new Date()`" prerender error means the year escaped its cache scope — fix the scope, never add `connection()` to the layout.

Run: `pnpm dev` (both apps start; stop it with Ctrl-C when done) and open `http://localhost:3000` — the shell renders right-to-left in Vazirmatn, light; the toggle switches theme and a reload keeps it (DoD 1). Say in the task report what you saw. Saman's own look is DoD 2 and comes after Task 9.

Run: `pnpm check`
Expected: green.

```bash
git add apps/web/app apps/web/components/site apps/web/lib/errors.ts apps/web/lib/errors.test.ts
git commit -m "feat(web): compose the shell, the home page and the error pages"
```

---

## Task 9: The `/design` gallery

Spec §4.5 and §10.3 (the acceptance surface: every primitive, every state, both themes, side by side, no interaction needed), D14 (ships in production, `noindex`), §8.1 (what must appear). This is what Saman reviews for DoD 2.

**Files:**

- Create: `apps/web/app/design/page.tsx`, `apps/web/app/design/theme-panel.tsx`, `apps/web/app/design/sections/colors.tsx`, `typography.tsx`, `buttons.tsx`, `links.tsx`, `surfaces.tsx`, `text-fields.tsx`, `badges.tsx`, `skeletons.tsx`, `price.tsx`, `empty-state.tsx`, `theme-toggle.tsx`
- Test: `apps/web/app/design/page.test.tsx`

**Interfaces:**

- Consumes: every primitive; `copy.design.*`; `formatToman` from `@ds/persian`.
- Produces: the route `/design`; `[data-panel="light"|"dark"]` wrappers and `[data-target]` marks that Task 11 queries; the section ids `colors typography buttons links surfaces text-fields badges skeletons price empty-state theme-toggle`.

- [ ] **Step 1: Write the failing test**

`apps/web/app/design/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DesignPage, { metadata } from './page'

const SECTION_COUNT = 11

describe('/design', () => {
  it('is not indexed (D14)', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('shows every section once, in a light and a dark panel, under one h1', () => {
    const { container } = render(<DesignPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(container.querySelectorAll('section')).toHaveLength(SECTION_COUNT)
    expect(container.querySelectorAll('[data-panel="light"]')).toHaveLength(SECTION_COUNT)
    expect(container.querySelectorAll('[data-panel="dark"]')).toHaveLength(SECTION_COUNT)
  })

  it('marks every control as a target, except links inside running text', () => {
    const { container } = render(<DesignPage />)
    const controls = [...container.querySelectorAll('button, input, a[href]')]
    const unmarked = controls.filter(
      (el) => !el.hasAttribute('data-target') && el.closest('p') === null,
    )
    expect(unmarked).toEqual([])
  })

  it('shows the loading, disabled and error states without interaction (§10.3)', () => {
    const { container } = render(<DesignPage />)
    expect(container.querySelectorAll('button[aria-busy="true"]').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelectorAll('button:disabled').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelectorAll('input[aria-invalid="true"]').length).toBeGreaterThanOrEqual(
      2,
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test --filter=web`
Expected: FAIL — `./page` does not exist.

- [ ] **Step 3: Write the panel and the page**

`apps/web/app/design/theme-panel.tsx`:

```tsx
import type { ReactNode } from 'react'
import { copy } from '@/lib/copy'

// Forces one theme on its subtree: the token blocks in globals.css are keyed
// on `[data-theme]`, on any element, so the page can show both at once.
export function ThemePanel({ theme, children }: { theme: 'light' | 'dark'; children: ReactNode }) {
  return (
    <div
      data-theme={theme}
      data-panel={theme}
      className="flex flex-col gap-6 rounded-lg border bg-background p-6 text-foreground"
    >
      <p className="text-caption font-semibold text-muted-foreground">
        {copy.design.panels[theme]}
      </p>
      {children}
    </div>
  )
}
```

`apps/web/app/design/page.tsx`:

```tsx
import type { Metadata } from 'next'
import type { ComponentType } from 'react'
import { copy } from '@/lib/copy'
import { BadgesSection } from './sections/badges'
import { ButtonsSection } from './sections/buttons'
import { ColorsSection } from './sections/colors'
import { EmptyStateSection } from './sections/empty-state'
import { LinksSection } from './sections/links'
import { PriceSection } from './sections/price'
import { SkeletonsSection } from './sections/skeletons'
import { SurfacesSection } from './sections/surfaces'
import { TextFieldsSection } from './sections/text-fields'
import { ThemeToggleSection } from './sections/theme-toggle'
import { TypographySection } from './sections/typography'
import { ThemePanel } from './theme-panel'

// D14: a real route, statically rendered, never indexed. Spec §4.5: a
// primitive or state that is not here does not exist.
export const metadata: Metadata = {
  title: copy.design.title,
  robots: { index: false, follow: false },
}

const SECTIONS: ReadonlyArray<{ id: string; title: string; Section: ComponentType }> = [
  { id: 'colors', title: copy.design.sections.colors, Section: ColorsSection },
  { id: 'typography', title: copy.design.sections.typography, Section: TypographySection },
  { id: 'buttons', title: copy.design.sections.buttons, Section: ButtonsSection },
  { id: 'links', title: copy.design.sections.links, Section: LinksSection },
  { id: 'surfaces', title: copy.design.sections.surfaces, Section: SurfacesSection },
  { id: 'text-fields', title: copy.design.sections.textFields, Section: TextFieldsSection },
  { id: 'badges', title: copy.design.sections.badges, Section: BadgesSection },
  { id: 'skeletons', title: copy.design.sections.skeletons, Section: SkeletonsSection },
  { id: 'price', title: copy.design.sections.price, Section: PriceSection },
  { id: 'empty-state', title: copy.design.sections.emptyState, Section: EmptyStateSection },
  { id: 'theme-toggle', title: copy.design.sections.themeToggle, Section: ThemeToggleSection },
]

export default function DesignPage() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-headline font-bold">{copy.design.title}</h1>
        <p className="text-body text-muted-foreground prose">{copy.design.intro}</p>
      </div>
      {SECTIONS.map(({ id, title, Section }) => (
        <section key={id} id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
          <h2 id={`${id}-title`} className="text-title font-bold">
            {title}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <ThemePanel theme="light">
              <Section />
            </ThemePanel>
            <ThemePanel theme="dark">
              <Section />
            </ThemePanel>
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write the eleven sections**

Each is a server component rendering states, never handlers. A small shared caption keeps the labels consistent — put it at the top of `sections/colors.tsx` and import it from the others? No: it is three lines, and a section must stay readable alone. Repeat it.

`apps/web/app/design/sections/colors.tsx`:

```tsx
// Token names are code identifiers, shown in Latin on purpose and marked ltr.
const SWATCHES = [
  { token: 'background', surface: 'bg-background border', ink: 'text-foreground' },
  { token: 'card', surface: 'bg-card border', ink: 'text-card-foreground' },
  { token: 'primary', surface: 'bg-primary border border-input', ink: 'text-primary-foreground' },
  { token: 'secondary', surface: 'bg-secondary', ink: 'text-secondary-foreground' },
  { token: 'muted', surface: 'bg-muted', ink: 'text-muted-foreground' },
  { token: 'accent', surface: 'bg-accent', ink: 'text-accent-foreground' },
  { token: 'destructive', surface: 'bg-destructive', ink: 'text-destructive-foreground' },
] as const

const EDGES = [
  { token: 'border', className: 'border' },
  { token: 'input', className: 'border border-input' },
  { token: 'ring', className: 'outline outline-2 outline-offset-2 outline-ring' },
] as const

export function ColorsSection() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SWATCHES.map(({ token, surface, ink }) => (
          <li
            key={token}
            className={`flex min-h-20 flex-col justify-end rounded-md p-3 ${surface}`}
          >
            <code dir="ltr" className={`text-caption font-medium ${ink}`}>
              {token}
            </code>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-3">
        {EDGES.map(({ token, className }) => (
          <li key={token} className={`rounded-md bg-card px-3 py-2 ${className}`}>
            <code dir="ltr" className="text-caption font-medium text-foreground">
              {token}
            </code>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

`apps/web/app/design/sections/typography.tsx`:

```tsx
import { formatToman } from '@ds/persian'
import { copy } from '@/lib/copy'

const SCALE = [
  { className: 'text-display font-extrabold', token: 'display' },
  { className: 'text-headline font-bold', token: 'headline' },
  { className: 'text-title font-bold', token: 'title' },
  { className: 'text-title-sm font-bold', token: 'title-sm' },
  { className: 'text-lead', token: 'lead' },
  { className: 'text-body', token: 'body' },
  { className: 'text-small', token: 'small' },
  { className: 'text-caption', token: 'caption' },
] as const

export function TypographySection() {
  return (
    <div className="flex flex-col gap-4">
      {SCALE.map(({ className, token }) => (
        <div key={token} className="flex flex-col gap-1">
          <code dir="ltr" className="text-caption text-muted-foreground">
            {token}
          </code>
          <p className={className}>{copy.design.samples.heading}</p>
        </div>
      ))}
      <p className="text-body prose">{copy.design.samples.paragraph}</p>
      <p className="text-body">{copy.design.samples.brandSentence}</p>
      <p className="text-title font-bold tabular-nums">{formatToman(28_500_000n)}</p>
    </div>
  )
}
```

`apps/web/app/design/sections/buttons.tsx`:

```tsx
import { Button } from '@/components/ui/button'
import { copy } from '@/lib/copy'
import { ICON_SIZE, IconClose, IconForward } from '@/lib/icons'

const VARIANTS = ['primary', 'secondary', 'ghost', 'destructive', 'link'] as const

export function ButtonsSection() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {copy.actions.addToCart}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg">
          {copy.actions.addToCart}
        </Button>
        <Button variant="primary" icon={<IconForward size={ICON_SIZE.md} />}>
          {copy.design.states.withIcon}
        </Button>
        <Button variant="secondary" size="icon" aria-label={copy.actions.close}>
          <IconClose size={ICON_SIZE.md} />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled>
          {copy.design.states.disabled}
        </Button>
        <Button variant="secondary" disabled>
          {copy.design.states.disabled}
        </Button>
        <Button variant="primary" loading>
          {copy.design.states.loading}
        </Button>
        <Button variant="secondary" loading icon={<IconForward size={ICON_SIZE.md} />}>
          {copy.design.states.loading}
        </Button>
      </div>
      <Button variant="primary" block>
        {copy.design.states.block}
      </Button>
    </div>
  )
}
```

`apps/web/app/design/sections/links.tsx`:

```tsx
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { copy } from '@/lib/copy'

export function LinksSection() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body prose">
        {copy.design.samples.linkSentence}{' '}
        <Link href="/design#links">{copy.design.samples.link}</Link>
      </p>
      <div>
        <Link
          variant="plain"
          href="/design#links"
          data-target=""
          className={buttonVariants({ variant: 'secondary' })}
        >
          {copy.design.states.inline}
        </Link>
      </div>
    </div>
  )
}
```

`apps/web/app/design/sections/surfaces.tsx`:

```tsx
import { Link } from '@/components/ui/link'
import { Surface, surfaceVariants } from '@/components/ui/surface'
import { copy } from '@/lib/copy'

function CardBody() {
  return (
    <div className="flex flex-col gap-1 p-4">
      <p className="text-title-sm font-bold">{copy.design.samples.cardTitle}</p>
      <p className="text-small text-muted-foreground">{copy.design.samples.cardBody}</p>
    </div>
  )
}

export function SurfacesSection() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Surface>
        <CardBody />
      </Surface>
      <Surface variant="raised">
        <CardBody />
      </Surface>
      <Surface variant="material">
        <CardBody />
      </Surface>
      <Link
        variant="plain"
        href="/design#surfaces"
        data-target=""
        className={surfaceVariants({ variant: 'pressable' })}
      >
        <CardBody />
      </Link>
    </div>
  )
}
```

`apps/web/app/design/sections/text-fields.tsx`:

```tsx
import { TextField } from '@/components/ui/text-field'
import { copy } from '@/lib/copy'

export function TextFieldsSection() {
  const { label, hint, placeholder, error } = copy.design.samples
  return (
    <div className="flex flex-col gap-6">
      <TextField label={label} hint={hint} placeholder={placeholder} inputMode="tel" />
      <TextField label={label} hint={hint} error={error} defaultValue="۰۹۱" inputMode="tel" />
      <TextField label={label} hint={hint} disabled defaultValue="۰۹۱۲۳۴۵۶۷۸۹" inputMode="tel" />
    </div>
  )
}
```

`apps/web/app/design/sections/badges.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import { copy } from '@/lib/copy'

export function BadgesSection() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="inverted">{copy.design.samples.badgeNew}</Badge>
      <Badge variant="outline">{copy.design.samples.badgeStock}</Badge>
      <Badge variant="destructive">{copy.design.samples.badgeOut}</Badge>
    </div>
  )
}
```

`apps/web/app/design/sections/skeletons.tsx`:

```tsx
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'

export function SkeletonsSection() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton shape="circle" className="size-12" />
        <Skeleton className="h-8 w-40" />
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}
```

`apps/web/app/design/sections/price.tsx`:

```tsx
import { Price } from '@/components/ui/price'

export function PriceSection() {
  return (
    <div className="flex flex-col gap-4">
      <Price amountMinor={28_500_000n} />
      <Price amountMinor={20_000_000n} original={30_000_000n} />
      <Price amountMinor={1_250_000_000n} />
    </div>
  )
}
```

`apps/web/app/design/sections/empty-state.tsx`:

```tsx
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { copy } from '@/lib/copy'
import { ICON_SIZE, IconEmpty } from '@/lib/icons'

export function EmptyStateSection() {
  return (
    <EmptyState
      icon={<IconEmpty size={ICON_SIZE.lg} />}
      title={copy.design.samples.emptyTitle}
      description={copy.design.samples.emptyBody}
      action={<Button variant="secondary">{copy.design.samples.emptyAction}</Button>}
    />
  )
}
```

`apps/web/app/design/sections/theme-toggle.tsx`:

```tsx
import { ThemeToggle } from '@/components/site/theme-toggle'
import { copy } from '@/lib/copy'

// The toggle switches the whole page; the panel it sits in stays forced.
export function ThemeToggleSection() {
  return (
    <div className="flex items-center gap-4">
      <ThemeToggle />
      <p className="text-small text-muted-foreground">{copy.theme.label}</p>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests, build, and look**

Run: `pnpm test --filter=web`
Expected: PASS.

Run: `pnpm lint --filter=web`
Expected: green. Class strings built with template literals in `colors.tsx` and `typography.tsx` are still linted — the plugin lints template literals — and every token there exists.

Run: `API_INTERNAL_URL=http://127.0.0.1:9 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm build --filter=web`
Expected: `/design` is static.

Run: `pnpm dev`, open `http://localhost:3000/design`, resize to a phone width, switch the page theme with the toggle. Report what each section looks like in one line each; fix anything that is visibly wrong in the primitive, not in the gallery.

Run: `pnpm check`
Expected: green.

```bash
git add apps/web/app/design
git commit -m "feat(web): add the design gallery"
```

---

## Task 10: Budgets — first-load JavaScript and the font, gating `pnpm check`

Spec §10.4 (`test/budget.test.ts`, `web#budget` depends on `build`, in `pnpm check`), §12 (`check` now builds web), foundation §7.9 (≤ 130 KB compressed per route, font ≤ 120 KB), DoD 8.

**Files:**

- Create: `apps/web/vitest.budget.config.ts`, `apps/web/test/budget.test.ts`
- Modify: `apps/web/package.json` (`budget` script), `.github/workflows/ci.yml` (`check` step env)

**Interfaces:**

- Consumes: `.next/app-build-manifest.json`, `.next/build-manifest.json`, `.next/static/**` from a production build; the vendored font.
- Produces: the `budget` script the root `budget` turbo task (declared in Task 2) now finds in `web`.

- [ ] **Step 1: Write the failing test and its config**

`apps/web/vitest.budget.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

// Runs after `next build` (turbo: web#budget dependsOn build). Kept out of
// vitest.config.ts so `pnpm test` needs no build.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/budget.test.ts'],
    clearMocks: true,
  },
})
```

`apps/web/test/budget.test.ts`:

```ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

// Foundation §7.9 and spec §10.4. "KB" is 1024 bytes; gzip at the default
// level approximates what a reverse proxy sends.
const root = fileURLToPath(new URL('../', import.meta.url))
const next = join(root, '.next')
const KB = 1024
const JS_BUDGET = 130 * KB
const FONT_BUDGET = 120 * KB
const FONT = join(root, 'app/fonts/Vazirmatn[wght].woff2')

type AppManifest = { pages: Record<string, string[]> }
type BuildManifest = { rootMainFiles: string[] }

function gzipped(file: string): number {
  return gzipSync(readFileSync(file)).length
}

/** Every JS file a first load of `route` needs: the root files, each ancestor layout, the page. */
function firstLoadFiles(app: AppManifest, build: BuildManifest, route: string): string[] {
  const files = new Set(build.rootMainFiles)
  const segments = route.split('/')
  for (let depth = 1; depth < segments.length; depth++) {
    const layout = `${segments.slice(0, depth).join('/')}/layout`
    for (const file of app.pages[layout] ?? []) files.add(file)
  }
  for (const file of app.pages[route] ?? []) files.add(file)
  return [...files].filter((file) => file.endsWith('.js'))
}

describe('budgets', () => {
  it('has a production build to measure', () => {
    expect(existsSync(join(next, 'app-build-manifest.json')), 'run `next build` first').toBe(true)
  })

  it('keeps every route’s first-load JavaScript within 130 KB gzipped', () => {
    const app = JSON.parse(
      readFileSync(join(next, 'app-build-manifest.json'), 'utf8'),
    ) as AppManifest
    const build = JSON.parse(
      readFileSync(join(next, 'build-manifest.json'), 'utf8'),
    ) as BuildManifest
    const routes = Object.keys(app.pages).filter((key) => key.endsWith('/page'))
    expect(routes.length).toBeGreaterThan(0)

    const report = routes.map((route) => {
      const bytes = firstLoadFiles(app, build, route).reduce(
        (sum, file) => sum + gzipped(join(next, file)),
        0,
      )
      return { route, kb: Math.round((bytes / KB) * 10) / 10, bytes }
    })
    console.info(report.map(({ route, kb }) => `${route}: ${kb} KB gzipped`).join('\n'))

    for (const { route, bytes } of report) {
      expect(bytes, `${route} first-load JavaScript`).toBeLessThanOrEqual(JS_BUDGET)
    }
  })

  it('keeps the vendored font within 120 KB', () => {
    expect(statSync(FONT).size).toBeLessThanOrEqual(FONT_BUDGET)
  })
})
```

- [ ] **Step 2: Verify the split, then watch the test fail**

Run: `pnpm test --filter=web`
Expected: PASS, and `test/budget.test.ts` is **not** in the list — the unit suite still needs no build.

A budget test cannot be watched failing for want of a build, because turbo builds before it runs. Watch it fail the way it will fail in life: change `const JS_BUDGET = 130 * KB` to `const JS_BUDGET = 1 * KB`, do Step 3, run `pnpm check`, and expect `web#budget` to FAIL naming every route with its size. Restore `130 * KB` before Step 4 and quote the failure in the task report.

- [ ] **Step 3: Add the script and the CI environment**

In `apps/web/package.json` `scripts`, after `"test"`:

```json
    "budget": "vitest run --config vitest.budget.config.ts",
```

In `.github/workflows/ci.yml`, the `check` job's `pnpm check:affected` step: `budget` now builds web inside `check`, and `envMode: strict` passes only declared variables, so the two build inputs join that step's `env` (same values as the DoD 9 step below it, so turbo replays the build from cache there):

```yaml
- run: pnpm check:affected
  env:
    TURBO_SCM_BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
    NEXT_PUBLIC_SITE_URL: http://localhost:3000
    # `budget` depends on `build`, and the build must succeed against an
    # unreachable API here exactly as in the DoD 9 step below.
    API_INTERNAL_URL: http://127.0.0.1:9
```

- [ ] **Step 4: Run the budget through turbo and read the numbers**

Run: `pnpm check`
Expected: green; `web#budget` builds web (roughly a minute, spec §16) and prints one line per route. Copy those lines into the task report — they are the baseline every later slice is measured against. If a route exceeds 130 KB, the cause is a client boundary that should not exist; find the `'use client'` file that pulled the weight in and move the work to the server, never raise the budget.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.budget.config.ts apps/web/test/budget.test.ts .github/workflows/ci.yml
git commit -m "feat(web): gate first-load JavaScript and the font on a budget"
```

---

## Task 11: End to end — Playwright with axe, and the `e2e` CI job

Spec §10.2 (every assertion listed there), §9 (the axe tags, targets), §12 (the `e2e` job), foundation §7.9 (`locale`, `timezoneId`, one desktop and one mobile project), DoD 4 and 8. Review Focus 2.

In 3a the web server is the only server; 3c adds the API, the services and the seed.

**Files:**

- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/shell.spec.ts`, `theme.spec.ts`, `design.spec.ts`, `routes.spec.ts`
- Modify: `.github/workflows/ci.yml` (new `e2e` job)

**Interfaces:**

- Consumes: the production build; `copy` (through the `@/` alias, which Playwright resolves from `tsconfig.json`); the `data-target`, `data-panel`, `data-variant` marks and the `skeleton` class.
- Produces: `pnpm e2e` (turbo `web#e2e`, builds first), `pnpm e2e:install` (Chromium, once per machine), the `e2e` job.

- [ ] **Step 1: Write the Playwright configuration**

`apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

// Foundation §7.9 and spec §10.2. In 3a only the web server runs; 3c adds
// the API. Chromium only — the mobile project is a Chromium device, so CI
// installs one browser.
const baseURL = 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm start',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { PORT: '3000' },
  },
})
```

- [ ] **Step 2: Write the four specs**

`apps/web/e2e/shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { copy } from '@/lib/copy'

test.describe('the shell', () => {
  test('renders right-to-left Persian in Vazirmatn with the four landmarks', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('dir', 'rtl')
    await expect(html).toHaveAttribute('lang', 'fa')

    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return [...document.fonts].some(
        (font) => /vazirmatn/i.test(font.family) && font.status === 'loaded',
      )
    })
    expect(loaded).toBe(true)

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('navigation', { name: copy.nav.primary })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })

  test('the skip link is first in the tab order and moves focus to main', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: copy.skipToContent })
    await expect(skip).toBeFocused()
    await skip.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })

  test('the footer year is Persian digits', async ({ page }) => {
    await page.goto('/')
    const footer = await page.getByRole('contentinfo').textContent()
    expect(footer).toMatch(/[۰-۹]{4}/)
    expect(footer).not.toMatch(/[0-9]/)
  })
})
```

`apps/web/e2e/theme.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import { copy } from '@/lib/copy'

const html = (page: Page) => page.locator('html')

async function choose(page: Page, option: string) {
  await page.getByRole('button', { name: copy.theme.label }).first().click()
  await page.getByRole('menuitemradio', { name: option }).click()
}

test.describe('theme (spec §5.6)', () => {
  test('is light by default, even when the OS prefers dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    await expect(html(page)).toHaveCSS('color-scheme', 'light')
  })

  test('a chosen dark theme survives a reload and ignores the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await choose(page, copy.theme.dark)
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(html(page)).toHaveCSS('color-scheme', 'dark')
    await page.reload()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  })

  test('the system option follows the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await choose(page, copy.theme.system)
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
  })

  test('the menu popup is right-to-left — the first portal (spec §8.1)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: copy.theme.label }).first().click()
    const popup = page.getByRole('menu')
    await expect(popup).toBeVisible()
    await expect(popup).toHaveCSS('direction', 'rtl')
    await expect(page.getByRole('menuitemradio')).toHaveCount(3)
  })

  test('an unknown stored value still renders light and can be changed (Review Focus 2)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('ds-theme', 'blue')
    })
    await page.goto('/')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 252)')
    await choose(page, copy.theme.dark)
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(8, 8, 19)')
  })
})
```

`apps/web/e2e/design.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// D16: WCAG 2.2 AA. Foundation §7.9's two tags reach WCAG 2.0 only.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function openIn(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((value) => {
    window.localStorage.setItem('ds-theme', value)
  }, theme)
  await page.goto('/design')
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

test.describe('/design (spec §10.2)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no axe violation at WCAG 2.2 AA in ${theme}`, async ({ page }) => {
      await openIn(page, theme)
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
      expect(results.violations).toEqual([])
    })
  }

  test('every marked control is at least 44 by 44 CSS pixels (spec §9, Fitts)', async ({
    page,
  }) => {
    await page.goto('/design')
    const boxes = await page.locator('[data-target]').evaluateAll((elements) =>
      elements.map((element) => {
        const { width, height } = element.getBoundingClientRect()
        return { width, height, text: (element.textContent ?? '').trim().slice(0, 24) }
      }),
    )
    expect(boxes.length).toBeGreaterThan(10)
    for (const box of boxes) {
      expect(box.width, `${box.text} width`).toBeGreaterThanOrEqual(44)
      expect(box.height, `${box.text} height`).toBeGreaterThanOrEqual(44)
    }
  })

  test('the tokens reach the DOM', async ({ page }) => {
    await page.goto('/design')
    for (const panel of ['light', 'dark']) {
      await expect(
        page.locator(`[data-panel="${panel}"] [data-variant="primary"]`).first(),
      ).toHaveCSS('background-color', 'rgb(160, 189, 219)')
    }
    await expect(page.locator('body')).toHaveCSS('letter-spacing', 'normal')
    const features = await page
      .locator('html')
      .evaluate((el) => getComputedStyle(el).fontFeatureSettings)
    expect(features).toContain('"ss01"')
    const sizes = await page
      .locator('input')
      .evaluateAll((inputs) =>
        inputs.map((input) => Number.parseFloat(getComputedStyle(input).fontSize)),
      )
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16)
  })

  test('reduced motion stills the shimmer and drops the press transform (spec §7.4)', async ({
    page,
  }) => {
    await page.goto('/design')
    const skeleton = page.locator('.skeleton').first()
    const pressable = page.locator('[data-variant="primary"]').first()
    await expect(skeleton).toHaveCSS('animation-name', 'shimmer')
    expect(await pressable.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain(
      'transform',
    )

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(skeleton).toHaveCSS('animation-name', 'none')
    expect(await pressable.evaluate((el) => getComputedStyle(el).transitionProperty)).not.toContain(
      'transform',
    )
  })
})
```

`apps/web/e2e/routes.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { copy } from '@/lib/copy'

test.describe('routes', () => {
  test('/health answers 200 ok (foundation §7.5)', async ({ request }) => {
    const response = await request.get('/health')
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('an unknown URL is a Persian 404 that is not indexed (foundation §7.6)', async ({
    page,
  }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole('heading', { level: 1, name: copy.errors.notFoundTitle }),
    ).toBeVisible()
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: copy.actions.backHome })).toHaveAttribute(
      'href',
      '/',
    )
  })

  test('/robots.txt is served (foundation §7.7)', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toMatch(/User-Agent: \*/i)
    expect(text).toMatch(/Allow: \//)
  })

  test('/design is not indexed (D14)', async ({ page }) => {
    await page.goto('/design')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})
```

- [ ] **Step 3: Install Chromium and run the suite; watch the first run**

Run: `pnpm e2e:install`
Expected: Chromium downloads (a 403 here is the VPN — stop and ask; `docs/runbooks/iran-mirrors.md` route 1).

Run: `pnpm e2e`
Expected: turbo builds web, Playwright starts `next start`, and both projects run every spec. The first run is the one to read closely: an axe violation names the element and the rule — fix the primitive; a bounding box under 44 px names the control — fix the primitive; a theme assertion failing on `color-scheme` means `enableColorScheme` is off. Never loosen an assertion to pass; if an assertion is wrong about the platform (not the code), say exactly why in the task report.

- [ ] **Step 4: Add the `e2e` job**

Append to `.github/workflows/ci.yml`, after the `check` job (before `authors`):

```yaml
e2e:
  if: github.event_name != 'schedule'
  timeout-minutes: 20
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
      with:
        fetch-depth: 0
    - uses: pnpm/action-setup@v6
    - uses: actions/setup-node@v5
      with:
        node-version-file: .node-version
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    # `next build` and `next start` read apps/web/.env from disk; the
    # example holds the local values and no secret.
    - run: cp apps/web/.env.example apps/web/.env
    # Chromium is cached on the Playwright pin. The catalog file is the only
    # place that pin lives, so its hash is the key; system libraries are not
    # cached and are installed on every run.
    - name: Cache Chromium
      id: chromium
      uses: actions/cache@v4
      with:
        path: ~/.cache/ms-playwright
        key: playwright-chromium-${{ runner.os }}-${{ hashFiles('pnpm-workspace.yaml') }}
    - if: steps.chromium.outputs.cache-hit != 'true'
      run: pnpm --filter web exec playwright install --with-deps chromium
    - if: steps.chromium.outputs.cache-hit == 'true'
      run: pnpm --filter web exec playwright install-deps chromium
    # The same two inputs as the DoD 9 build in `check`; `pnpm e2e` then
    # replays the build from turbo's cache and starts the server.
    - run: pnpm turbo run build --filter=web --output-logs=errors-only
      env:
        NEXT_PUBLIC_SITE_URL: http://localhost:3000
        API_INTERNAL_URL: http://127.0.0.1:9
    - run: pnpm e2e
      env:
        CI: 'true'
        NEXT_PUBLIC_SITE_URL: http://localhost:3000
        API_INTERNAL_URL: http://127.0.0.1:9
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: apps/web/playwright-report
        retention-days: 7
```

The job runs in the workflow's existing `concurrency` group. It becomes a required check on `main` after its first green run on this pull request — Saman's step in the ruleset, per foundation §13.1.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint --filter=web` (the specs are linted under the strict base and the boundaries `test` category) and `pnpm check`.
Expected: green.

```bash
git add apps/web/playwright.config.ts apps/web/e2e .github/workflows/ci.yml
git commit -m "feat(web): add Playwright with axe and the e2e job"
```

---

## Task 12: Documentation, rules, and the amendments

Spec §13 in full, DoD 9. Every document the phase promised, the foundation spec's dated amendments, and the corrections this plan's deviations owe the 3a spec.

**Files:**

- Create: `docs/decisions/0019-two-colour-design-tokens.md`, `apps/web/CLAUDE.md`
- Modify: `.claude/rules/web.md`, `.claude/agents/reviewer.md`, `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-08-27-foundation-design.md`, `docs/superpowers/specs/2026-09-25-storefront-design-system-design.md`, `docs/architecture/north-star.md`, `.github/renovate.json`, `scripts/check-docs.manifest`, `scripts/check-docs.sh`, `docs/runbooks/iran-mirrors.md`

**Interfaces:** none — prose. `pnpm check:docs` is the test: every manifest entry exists, `apps/web/CLAUDE.md` ≤ 60 lines, the ADR carries the three headings, every relative link resolves case-exactly, the new `assert_contains` guards hold.

- [ ] **Step 1: Write ADR-0019**

`docs/decisions/0019-two-colour-design-tokens.md`:

```md
# 0019. Two-colour design tokens with enforced semantics

- Status: accepted
- Date: 2026-09-25

## Context and Problem Statement

The storefront needs its colour system before any product page exists, so every later slice inherits it instead of inventing one ([3a spec](../superpowers/specs/2026-09-25-storefront-design-system-design.md) D11). Saman chose two colours, Black Iris `#080813` and Frozen `#A0BDDB`; there is no designer and no Figma file, and the `/design` gallery is the source of truth. Tailwind ships a twenty-two-hue palette and shadcn's initialiser writes an oklch neutral theme, and either lets a third colour reach a component without anyone deciding it should. The tokens must also meet WCAG 2.2 AA in both themes, and Frozen measures 1.95:1 on white, so it can be a surface but never an ink on a light page.

## Considered Options

- shadcn's default theme: oklch neutrals plus one primary, with Tailwind's palette left available.
- A full tint ramp (50–950) generated from each brand colour.
- Two colours with derived neutrals under shadcn's semantic names, Tailwind's palette and default scales deleted.

## Decision Outcome

Chosen: **two colours with derived neutrals under shadcn's semantic names**, because it is the only option where the palette is a fact rather than a convention. Every neutral is one colour mixed over the other, or over paper or white, at a recorded percentage; `apps/web/test/tokens.test.ts` re-derives each from the two primitives and fails when a committed hex drifts, then checks every text pair at ≥ 4.5:1 and the control boundary at ≥ 3:1 in both themes. `--color-*: initial` in `app/globals.css` deletes Tailwind's palette, so `bg-blue-500` is an unknown class and `eslint-plugin-better-tailwindcss` fails the build on it; the same deletion applies to the default type, radius, shadow, easing and weight scales. shadcn's token names are kept so every component its CLI generates works unchanged. Light is the default; dark inverts the ink and keeps the primary fill.

### Consequences

- Good: a third colour cannot appear by accident, and a contrast regression fails a unit test rather than an audit.
- Good: light and dark share one primary button, byte for byte, so the brand reads the same in both.
- Bad: a semantic colour beyond the destructive red (success, warning) needs a new ADR and new derivations, not a class.
- Bad: dark-mode body text is pure Frozen and may read too blue on some screens; the remedy is one token and one test run.

**Reversed if** a third brand colour becomes necessary, or a required state cannot reach 4.5:1 from the two colours.
```

- [ ] **Step 2: Extend `.claude/rules/web.md`**

Append after the existing bullets:

```md
## Design system (spec `docs/superpowers/specs/2026-09-25-storefront-design-system-design.md`)

- **Tokens only.** No literal colour, size, radius, shadow or duration in a
  component. `app/globals.css` is the source of truth; Tailwind's palette and
  its default type, radius, shadow, easing and weight scales are deleted, so
  `bg-blue-500`, `text-xl`, `shadow-lg` are unknown classes and fail lint.
  An arbitrary colour (`bg-[#…]`) fails lint.
- **Two colours, light by default.** Black Iris and Frozen; dark inverts the
  ink, never the primary fill. Frozen is a surface, never an ink on a light
  page. `test/tokens.test.ts` guards every pair; change a token, run it.
- **The type scale only.** `text-caption … text-display`, each carrying its
  own leading. `tracking-*`, `leading-none`, `leading-tight` and
  `text-left|right|justify` fail lint. Inputs are never under 16 px.
- **Digits are formatted on the server by `@ds/persian`.** `Price` is the
  only way a price reaches the page. An ASCII digit in customer-facing copy
  is a test failure; `font-feature-settings: 'ss01'` on `html` is a safety
  net, not the policy.
- **Copy lives in `lib/copy.ts`**, icons in `lib/icons.ts` under semantic
  names (`lucide-react` is importable nowhere else; forward is left), error
  sentences in `lib/errors.ts`.
- **Motion is CSS from tokens.** `--duration-press|quick|fade`,
  `--ease-out|in`; press feedback on pointer-down; hover only on hover
  devices; focus rings instant. No entrance choreography, ever. Reduced
  motion, reduced transparency and `prefers-contrast: more` are honoured in
  `globals.css`, not per component. Springs come from `lib/motion.ts`;
  `motion` is installed by the first gesture surface, loaded through
  `LazyMotion` with `domAnimation` and `m`. When that surface arrives:
  momentum projection is `((v / 1000) * rate) / (1 - rate)` with
  `rate = 0.998`, and rubber-banding is
  `(d * dimension * 0.55) / (dimension + 0.55 * |d|)` (apple-design §6, §9).
- **Targets ≥ 44 × 44 px, marked `data-target`.** Exactly one primary action
  per view; ≤ 7 items in a nav or menu; one accent per view — the primary
  button or the inverted badge, never both competing.
- **A primitive or state not on `/design` does not exist.** Adding one means
  adding it to the gallery in every state, in both panels.
- **Static shell.** No `cookies()` or `headers()` in a layout; the theme is
  `next-themes`' pre-paint script. `'use client'` only in Base UI wrappers,
  the theme provider and toggle, and Next's own error boundaries.
- **Browser floor: Tailwind 4.3** — Safari 16.4+, Chrome 111+. Do not lower
  it with a polyfill or a fallback stylesheet.
```

- [ ] **Step 3: Write `apps/web/CLAUDE.md` (≤ 60 lines — count them)**

```md
# apps/web — the storefront

Next.js 16 App Router on Cache Components, React 19, Tailwind 4, shadcn on
Base UI, Vazirmatn. Persian, right-to-left, two colours. The design system
is `app/globals.css` plus `components/ui`; its spec is
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
  Wordmark, ThemeToggle, Providers.
- `lib/` — `copy.ts` (every Persian string), `icons.ts` (semantic names),
  `errors.ts`, `motion.ts`, `env.ts` (`getServerEnv()`, lazy), `site.ts`,
  `utils.ts` (`cn`, taught the deleted scales).
- `test/` — tokens, lint regression, budget, env. `e2e/` — Playwright.

## Boundaries (lint-enforced)

`lib` → workspace packages only · `components/ui` → `lib` ·
`components/site` → `ui` + `lib` · `app` → anything · nothing → `app` ·
never `apps/api`.

## What fails the build

- A class outside the tokens (`bg-blue-500`, `text-xl`, `bg-[#fff]`).
- A physical utility, even behind a variant (`md:ml-4`); `tracking-*`;
  `leading-none|tight`; `text-left|right|justify`; numeric `z-*`.
- `export const dynamic | revalidate | fetchCache | runtime | dynamicParams`.
- `lucide-react` outside `lib/icons.ts`; `next/font/google` anywhere.
- A token whose text pair drops below 4.5:1, or `--input` below 3:1.
- A route over 130 KB of gzipped first-load JavaScript; the font over 120 KB.
- An axe violation at WCAG 2.2 AA on `/design`; a target under 44 × 44.

## What a reviewer checks

One primary action per view; one accent; ≤ 7 nav items; spacing tiers
(2–4 inside a component, 6–8 between groups, 12–16 between sections);
Persian digits everywhere; no entrance animation; every new primitive and
state on `/design`.
```

- [ ] **Step 4: Add the review-enforced rows to `.claude/agents/reviewer.md`**

After item 5 in the numbered list:

```md
6. **Design system.** A literal colour, size or duration in a component; a
   class outside the tokens; a primitive or state missing from `/design`;
   more than one primary action in a view; two accents competing; a nav or
   menu over seven items; an interactive target under 44 px; an entrance
   animation; copy outside `lib/copy.ts`; `lucide-react` imported outside
   `lib/icons.ts`; spacing that does not follow the tiers.
7. **Persian rendering.** An ASCII digit in customer-facing output; a price
   not rendered through `Price`; `tracking-*` or a physical alignment class;
   centred text outside an empty state or the hero.
```

- [ ] **Step 5: Update `README.md`**

Replace the status block with:

```md
> **Status: foundation.** The repository, toolchain, quality gates,
> documentation system, the API's foundation and the storefront's foundation
> exist — configuration, migrations, health probes, the transactional outbox,
> Redis and object storage on the API side; the shell, the two-colour design
> system, light and dark themes, the `/design` gallery and the Playwright +
> axe suite on the web side. No product feature does: the catalogue arrives
> with Phase 3b and the brand pages with 3c. The table below is the chosen
> stack, not a list of what is built.
```

Change the UI row of the stack table to:

```md
| UI | Tailwind CSS 4 — two-colour tokens, logical utilities only; shadcn on Base UI; Vazirmatn |
```

In Quickstart: after the `cp apps/api/.env.example apps/api/.env` line add a line `cp apps/web/.env.example apps/web/.env  # local values, no secret`; change the comment on `pnpm dev` to `# api on :3001, web on :3000`; and replace the paragraph beginning "The API refuses to boot" with:

```md
The API refuses to boot on an invalid environment, so the copies are not
optional. The storefront serves its shell and the design gallery at
`http://localhost:3000/design`; there is nothing to seed until Phase 3b.
End to end: `pnpm e2e:install` once per machine (Chromium), then `pnpm e2e`.
```

Change the layout row for `apps/web` to `| `apps/web` | Next.js storefront — shell, design system,`/design` gallery, e2e |`, and add to Documentation:

```md
- [Storefront foundation and design system](docs/superpowers/specs/2026-09-25-storefront-design-system-design.md)
```

- [ ] **Step 6: Update `CLAUDE.md`**

- The `pnpm dev` row: `| `pnpm dev`              | api on 3001, web on 3000                            |`
- Add a row after `pnpm check`: `| `pnpm e2e`              | Playwright + axe against the production web build   |`
- In "Non-negotiables", after the logical-utilities bullet, add:

```md
- **Tokens only in `apps/web`.** No literal colour, size or duration; the
  default palette is deleted and an unknown class fails lint. A primitive or
  state not on `/design` does not exist.
```

- In "Commits and branches": `squash-merged` → `rebase-merged (ADR-0018)`.

Keep the file under 150 lines (`pnpm check:docs` counts).

- [ ] **Step 7: Amend the foundation spec (dated, pointing here)**

In `docs/superpowers/specs/2026-08-27-foundation-design.md`:

1. **Status row:** replace `Phase 1 complete and merged; Phase 2 in planning` with `Phases 1 and 2 merged; Phase 3 in progress as sub-phases 3a / 3b / 3c (3a spec (a markdown link whose target is `./2026-09-25-storefront-design-system-design.md`, the two specs sharing a directory), amended 2026-09-25)`.
2. **Next step row:** replace its content with: Phase 3a per the plan `docs/superpowers/plans/2026-09-25-storefront-design-system.md`; then 3b (Brand through the API) and 3c (the brand pages).
3. **§4.3 rule 4:** replace `it uses `@ds/contracts`and`@ds/api-client` only.` with `it uses `@ds/contracts`, `@ds/api-client`and`@ds/persian` (formatting, §7.3) only — **amended 2026-09-25**; the rule and §7.3 disagreed.`
4. **§7.2, the shadcn bullet:** append `**Amended 2026-09-25** (3a spec (a markdown link whose target is `./2026-09-25-storefront-design-system-design.md`, the two specs sharing a directory) §4.1):`tw-animate-css`is not installed — overlay motion comes from the design system's own utilities — and`components.json`is written by hand to the values`init --rtl -b base --pointer`produces, because 4.21's initialiser also installs`shadcn` as a runtime dependency and a Google-font item.`
5. **§7.8, after "That is the entire UI at foundation.":** append `**Amended 2026-09-25:** the foundation UI also includes`/design` (noindex) and the theme toggle; the sentence reads across sub-phases 3a and 3c.`
6. **§7.9:** replace `withTags(['wcag2a', 'wcag2aa'])` with `withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])` and append to that bullet ` **Amended 2026-09-25** (3a spec D16): WCAG 2.2 AA; the two original tags reached WCAG 2.0 only.`
7. **§13.1, at the end:** append ` **Amended 2026-09-25** (3a spec D8): Phase 3 is three sub-phases — 3a the storefront foundation and design system, 3b Brand through the API, 3c the brand pages — each its own rebase-merge pull request.`

- [ ] **Step 8: Amend the 3a spec with this plan's deviations**

In `docs/superpowers/specs/2026-09-25-storefront-design-system-design.md`:

1. **Status row:** `Approved by Saman Hoseinpour, 2026-09-25. Plan: [2026-09-25-storefront-design-system.md](../plans/2026-09-25-storefront-design-system.md)`.
2. **Next step row:** `Execute the plan on `feat/web-foundation`; one rebase-merge PR; then 3b`.
3. **§4.1, at the end:** `**Amended 2026-09-25 (plan, deviation 1):** the initializer is not run;`components.json`and`lib/utils.ts`are written by hand to the values it would produce, because 4.21's base item installs`shadcn`at runtime,`tw-animate-css` and a Google-font item.`
4. **§4.4:** replace `'use client'` appears in exactly two places: the theme provider and toggle (§5.6), and primitives that wrap a Base UI component, which Base UI requires.`with`'use client'`appears only in the theme provider and toggle (§5.6), in primitives that wrap a Base UI component, which Base UI requires, and in`error.tsx`and`global-error.tsx`, which Next.js requires to be client components (amended 2026-09-25).`

- [ ] **Step 9: north-star, Renovate, the runbook**

`docs/architecture/north-star.md` §2 rule 3: replace `It uses `@ds/contracts`and`@ds/api-client` only.` with `It uses `@ds/contracts`, `@ds/api-client`and`@ds/persian` only.`

`.github/renovate.json`, in `packageRules` after the `drizzle` group (`eslint-plugin-better-tailwindcss` is already caught by the `eslint` group's `eslint-plugin-**`):

```json
    {
      "groupName": "tailwind",
      "matchPackageNames": ["tailwindcss", "@tailwindcss/**", "prettier-plugin-tailwindcss"]
    },
    {
      "groupName": "ui",
      "matchPackageNames": [
        "@base-ui/react",
        "lucide-react",
        "next-themes",
        "class-variance-authority",
        "clsx",
        "tailwind-merge"
      ]
    },
```

`docs/runbooks/iran-mirrors.md`, route 1: `Connect the VPN before `pnpm db:up`, `pnpm test:integration`or`pnpm e2e`.` → `Connect the VPN before `pnpm db:up`, `pnpm test:integration`, `pnpm e2e:install`(Chromium) or`pnpm e2e`.`

- [ ] **Step 10: The docs check learns the new files**

Append to `scripts/check-docs.manifest`:

```
apps/web/CLAUDE.md
apps/web/package.json
apps/web/tsconfig.json
apps/web/next.config.ts
apps/web/postcss.config.mjs
apps/web/components.json
apps/web/.env.example
apps/web/vitest.config.ts
apps/web/vitest.budget.config.ts
apps/web/playwright.config.ts
apps/web/app/globals.css
apps/web/app/fonts/OFL.txt
```

In `scripts/check-docs.sh`, after the existing `assert_contains commitlint.config.mjs …` line:

```bash
assert_contains apps/web/app/globals.css '--color-*: initial' '@custom-variant dark'
assert_contains apps/web/next.config.ts 'cacheComponents: true' 'reactCompiler: true' "output: 'standalone'"
assert_contains packages/config-eslint/next.js 'enforce-logical-properties' 'no-unknown-classes' 'boundaries/dependencies'
assert_contains prettier.config.mjs 'prettier-plugin-tailwindcss'
```

The glossary gains no row: the phase introduces no domain term, and «طرح روشن / تاریک» is interface copy, not ubiquitous language.

- [ ] **Step 11: Verify and commit**

Run: `pnpm check:docs`
Expected: `check-docs: OK` — every link resolves case-exactly (the ADR links to the 3a spec, the spec links to the plan), `apps/web/CLAUDE.md` is ≤ 60 lines, `CLAUDE.md` < 150.

Run: `pnpm check`
Expected: green.

```bash
git add docs .claude/rules/web.md .claude/agents/reviewer.md README.md CLAUDE.md apps/web/CLAUDE.md .github/renovate.json scripts/check-docs.manifest scripts/check-docs.sh
git commit -m "docs(web): record the design system decisions and rules"
```

---

## Phase 3a completion

The phase is done when all of the following hold, mapped to the spec's §14:

| DoD | Proof                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm dev` → web on 3000; `/` renders right-to-left in Vazirmatn, light; the toggle switches and a reload keeps the choice (Task 8, and `e2e/theme.spec.ts`)                                                                                                                                                                                                                       |
| 2   | **Saman opens `/design` on a phone and a laptop, in both themes, and approves it.** This is the one item no agent can close. The §5.3 review point — dark body text in pure Frozen — is decided here; if it reads too blue, `--foreground` in the dark block becomes a lighter Frozen tint, the derivation table in `test/tokens.test.ts` gains that mix, and every pair is re-run |
| 3   | `pnpm check` is green and runs web's `lint`, `typecheck`, `test` and `budget` (Tasks 2, 4, 10)                                                                                                                                                                                                                                                                                     |
| 4   | `pnpm e2e` is green locally; the `e2e` job is green on the pull request (Task 11)                                                                                                                                                                                                                                                                                                  |
| 5   | `API_INTERNAL_URL=http://127.0.0.1:9 NEXT_PUBLIC_SITE_URL=http://localhost:3000 pnpm build --filter=web` succeeds (Task 2, every task after)                                                                                                                                                                                                                                       |
| 6   | `apps/web/test/lint.test.ts` fails on each listed case (Task 4)                                                                                                                                                                                                                                                                                                                    |
| 7   | the mutation record in Task 3's report                                                                                                                                                                                                                                                                                                                                             |
| 8   | `e2e/design.spec.ts` (targets, axe) and `test/budget.test.ts` (font, routes)                                                                                                                                                                                                                                                                                                       |
| 9   | `pnpm check:docs` passes; `apps/web/CLAUDE.md` ≤ 60 lines (Task 12)                                                                                                                                                                                                                                                                                                                |
| 10  | `pnpm audit:authors` passes; one rebase-merge PR `feat/web-foundation` → `main` ([ADR-0018](../../decisions/0018-one-pr-per-phase.md))                                                                                                                                                                                                                                             |

Then, in order: the whole-branch review (the `reviewer` agent, with its new checklist rows); `git push` (asks); the pull request with the template's checklist, linking spec §14; after `check`, `e2e`, `authors` and `secrets` are green, Saman promotes `e2e` to a required check in the `main` ruleset (foundation §13.1) and rebase-merges.

**Deliberately not in 3a**, each with its owner: `motion` and every gesture surface (the first is the mobile navigation sheet); `Dialog`, `Sheet`, `Select`, `Checkbox`, `Radio`, `Switch`, `Tabs`, `Toast`, `Tooltip`, `Table`, `Pagination`, `Carousel` and the quantity stepper (`shadcn add`, Base UI variant, when a slice needs them); pixel snapshots (baselines from the Playwright Docker image); Lighthouse CI; `requestApi()` and `X-Forwarded-For` (the identity spec); images, a real logo and a favicon set (the media spec); `proxy.ts` and CSP (`next-themes` then takes a `nonce`); `packages/ui`; `Dockerfile.web` (Phase 4). `@next/playwright` is pinned and unused until 3c's first navigation test; `@vitejs/plugin-react` is not installed (Deviation 5).

**Recorded for 3b and 3c:** `lib/env.ts`'s `getServerEnv()` has no caller until `publicApi` exists; `lib/errors.ts` gains its API consumer when `ApiError` arrives; the `e2e` job gains Postgres, Redis, the API server and the seed in 3c, and its `webServer` becomes the two-server array foundation §7.9 describes. The `chore/apple-design-skill` branch is fully contained in `feat/web-foundation` and can be deleted.
