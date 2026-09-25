# Test shapes

Ground truth: `.claude/rules/testing.md`, spec §10, `apps/web/vitest.config.ts`,
`apps/web/test/setup.ts`, `apps/web/e2e/*.spec.ts`. Write the test, watch it
fail for the intended reason, then write the code.

## Unit — Vitest 5, jsdom, Testing Library (`pnpm --filter web test`)

- `css: false`: assert classes (`toHaveClass('bg-primary')`) and roles, never
  computed styles — those belong to e2e.
- `'server-only'` is aliased to a stub, so a server component (`Price`,
  `EmptyState`) renders as a plain function: `render(<Price amountMinor={28500000n} />)`.
- `matchMedia` and `ResizeObserver` are stubbed in `test/setup.ts`; a Base UI
  wrapper renders in jsdom, and `userEvent` opens it.
- `clearMocks: true` is set; `vi.mock` only at module top level.
- Queries use the Persian name: `screen.getByRole('button', { name: 'ادامه' })`.

```tsx
// components/ui/button.test.tsx — the house shape
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'destructive', 'link'] as const)(
    'renders the %s variant as a marked target',
    (variant) => {
      render(<Button variant={variant}>ادامه</Button>)
      const button = screen.getByRole('button', { name: 'ادامه' })
      expect(button).toHaveAttribute('data-variant', variant)
      expect(button).toHaveAttribute('data-target')
    },
  )

  it('keeps the label and sets aria-busy while loading', () => {
    render(<Button loading>ادامه</Button>)
    expect(screen.getByRole('button', { name: 'ادامه' })).toHaveAttribute('aria-busy', 'true')
  })
})
```

```tsx
// components/ui/price.test.tsx — a digit that reaches the page is a failure
it('never emits an ASCII digit', () => {
  const { container } = render(<Price amountMinor={28500000n} original={30000000n} />)
  expect(container.innerHTML).not.toMatch(/[0-9]/)
  expect(container).toHaveTextContent('تومان')
})
```

- Copy: `lib/copy.test.ts` fails on a Latin letter or an ASCII digit in any
  value outside its allow-list — add the key, run it.
- Errors: `lib/errors.test.ts` maps every `ErrorCode`; a code added to
  `@ds/contracts` fails it until `lib/errors.ts` has its Persian sentence.

## Tokens and lint (`test/tokens.test.ts`, `test/lint.test.ts`; node environment)

- A new colour token: its text pair goes in the table `tokens.test.ts`
  checks — a token without a pair fails, a pair under 4.5:1 fails, `--input`
  under 3:1 fails. Change a token, run the file.
- A new restricted class or lint rule: one rejected fixture and one accepted
  fixture in `lint.test.ts`, which lints virtual files with `webRules` from
  `@ds/config-eslint/next`. The message prefix (`arbitrary-colour:`,
  `route-segment-config`, `api-boundary`) is what the assertion matches, so
  a new rule's message opens with its name.

## e2e — Playwright + axe (`pnpm e2e`, against `next start` of the production build)

- `locale: 'fa-IR'`, `timezoneId: 'Asia/Tehran'`, a desktop and a mobile
  project. `pnpm e2e:install` once per machine; from Iran, the VPN runbook.
- A new route gets a spec in `e2e/`: the axe run, the `[data-target]`
  bounding boxes, the Persian `h1`, `html[dir="rtl"]`. Prefer role and
  computed-style assertions; no pixel snapshots — fonts rasterise differently
  on the Linux runner (spec §10.2).

```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] // D16: WCAG 2.2 AA

test('/brands renders right to left with no axe violation', async ({ page }) => {
  await page.goto('/brands')
  await expect(page.getByRole('heading', { level: 1, name: 'برندها' })).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(results.violations).toEqual([])
  const boxes = await page
    .locator('[data-target]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
})
```

## Budget (`pnpm --filter web budget`, inside `pnpm check`)

- Reads the production build's manifest and gzips each route's chunks: a
  route whose own JavaScript beyond Next's root files exceeds 100 KB fails,
  root files over 140 KB fail, a font over 120 KB fails; totals are reported.
- A `'use client'` import pulls its whole module graph into that route's
  share. Read the report line after adding one; a shared menu, popover or
  select reuses the toggle's Base UI + floating-ui chunk rather than adding a
  second library.

## What `pnpm check` does not run

- The browser: `pnpm e2e` is a separate command — run it when a view changed.
- The build against an unreachable API is part of `check` (budget depends on
  `build`), so a component that calls the API from the shell fails there.
