# Primitives, Base UI and the gallery

Ground truth: spec §8 (inventory and icons), §4.4 (server or client), §5.4
(scales), §11 (lint); the files under `apps/web/components/`. Read the
component before extending it — this table is the map, not the territory.

## Inventory (spec §8.1)

| Primitive                           | File                 | Shape                                                                                                                                                                                                                                                                      | Client                                                                                    |
| ----------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Button                              | `ui/button.tsx`      | `variant` primary · secondary · ghost · destructive · link; `size` md (44) · lg (48) · icon (44 square); `block`; `loading` (spinner in the icon slot, label kept, width kept, `aria-busy`, a second submit swallowed); `icon`. Defaults `secondary` / `md`; `data-target` | no — a plain `<button>`; `buttonVariants` is exported for a link that looks like a button |
| Link                                | `ui/link.tsx`        | `next/link`; `variant` text (always underlined) · plain (a card, a button look, the wordmark)                                                                                                                                                                              | no                                                                                        |
| Surface                             | `ui/surface.tsx`     | `variant` default · raised · material (floating chrome only; never two stacked) · pressable (a whole-card link: put it on `Link variant="plain"`)                                                                                                                          | no                                                                                        |
| Badge                               | `ui/badge.tsx`       | `variant` inverted (the one Von Restorff chip) · outline · sale (solid) · success · warning · destructive (soft state badges); caption size, weight 600                                                                                                                    | no                                                                                        |
| Skeleton / SkeletonText             | `ui/skeleton.tsx`    | `shape` block · line · circle; `SkeletonText lines={n}` for a Suspense fallback; `aria-hidden`; static under reduced motion                                                                                                                                                | no                                                                                        |
| Price                               | `ui/price.tsx`       | `amountMinor: bigint`, `original?: bigint` → `formatToman`, `tabular-nums`, a struck original, a sale badge with the truncated percentage; 0 % is no discount; `server-only`                                                                                               | no                                                                                        |
| EmptyState                          | `ui/empty-state.tsx` | `icon`, `title`, `description`, one `action`, `as="h1"` when it is the page; centred                                                                                                                                                                                       | no                                                                                        |
| TextField                           | `ui/text-field.tsx`  | Base UI Field: label above, `hint`, `error` through `aria-describedby` and `aria-invalid`; 48 px tall, 16 px text; pass `inputMode`                                                                                                                                        | yes                                                                                       |
| Header, Footer, Wordmark, Providers | `site/`              | the material sticky header on `z-header` with one labelled `nav`; `Providers` holds `DirectionProvider`                                                                                                                                                                    | Providers only                                                                            |

Not built (spec §8.1): Dialog, Sheet, Select, Checkbox, Radio, Switch, Tabs,
Toast, Tooltip, Table, Pagination, Carousel, a quantity stepper.

Icons: `lib/icons.ts` only, semantic names (`IconForward`, `IconBack`,
`IconExternal`, `IconClose`, `IconCheck`, `IconSpinner`, `IconAlert`,
`IconEmpty`, …), `ICON_SIZE.sm|md|lg` = 16 / 20 / 24, `aria-hidden` unless
the icon is the only content of a labelled control. A new icon is a new
export there, named for what it means, not what it draws.

## Adding a variant or a state

1. The test first: an `it.each` over the new variant in `<name>.test.tsx`
   asserting its role and its token classes.
2. Add it to the `cva` map with token utilities only. `cn` (`lib/utils.ts`)
   merges; a value from a scale `extendTailwindMerge` does not know is
   dropped silently — teach it there.
3. Add it to `app/design/sections/<name>.tsx`: every variant × size × state,
   rendered as props (`loading`, `disabled`, `error="…"`) so nothing needs a
   click.
4. `pnpm check` (lint, tokens, budget), then `pnpm e2e` (axe, 44 px on every
   `[data-target]`).

## Adding a primitive with shadcn (Base UI)

1. `pnpm dlx shadcn@4.21.0 add <name>` is an ask command (foundation
   §12.2). Read what it wants to install before saying yes: every package
   must already be a `catalog:` entry at least a day old or the install is
   refused; `tw-animate-css`, a runtime `shadcn` dependency and any
   Google-font item are declined (spec §4.1).
2. Run `eslint .` once. The generated `text-xs|sm|lg`, `rounded-xl`,
   `shadow-lg`, `ease-in-out`, `font-light`, `z-50`, `duration-200` are
   unknown or restricted classes: remap to `text-caption|small|lead`,
   `rounded-md`, `shadow-md`, `ease-out`, `font-normal`, `z-overlay`,
   `duration-(--duration-quick)`. Physical classes (`ml-`, `left-`,
   `rounded-tl`) become logical (`ms-`, `start-`, `rounded-ss`). Animation
   classes (`animate-in`, `slide-in-from-left-*`, `fade-in-0`) are deleted in
   favour of the `popup` utility on the popup element.
3. `'use client'` on the wrapper file; anything that renders no Base UI part
   stays a server component.
4. Strings to `lib/copy.ts`; icons to `lib/icons.ts` — the wrapper never
   imports `lucide-react`.
5. A gallery section, the tests, `data-target=""` on every interactive part.

## Base UI patterns

- Per-component imports: `import { Menu } from '@base-ui/react/menu'`,
  `/dialog`, `/popover`, `/select`, `/field`, `/direction-provider`.
- Composition is the `render` prop, never `asChild`:
  `<Menu.Item render={<Link href="/account" variant="plain" />}>…</Menu.Item>`;
  the function form receives `(props, state)`. Base UI merges props and refs,
  and React 19 passes `ref` as a prop — no `forwardRef` anywhere.
- State is a data attribute, styled with Tailwind's `data-*` variants:
  `data-highlighted:bg-accent`, `data-invalid:border-destructive`,
  `data-disabled:opacity-50`, `data-open`, and `data-starting-style` /
  `data-ending-style`, which the `popup` utility animates.
- Popup anatomy: `Portal` → `Positioner` (`side`, `align`, `sideOffset={8}`,
  `className="z-overlay"`) → `Popup` (`popup rounded-md border bg-popover p-1
text-popover-foreground shadow-md outline-none`). A portal renders into
  `<body>` and inherits `dir="rtl"` from `<html>`; the first popup's e2e spec
  asserts `direction: rtl` on it. `align` is logical under `DirectionProvider`.
- `DirectionProvider direction="rtl"` wraps the app once in
  `components/site/providers.tsx`; never add a second one.
- Focus, Escape, focus return, typeahead and outside-press are Base UI's;
  do not re-implement them. Add ARIA only for what the component cannot
  know — `aria-label={copy.…}` on an icon-only trigger.
- Sheets and dialogs, when they arrive: the positioner and backdrop on
  `z-sheet`, one scrim, and the `material` never stacked on another
  `material` (spec §5.5).
- The compiler: each Base UI primitive is verified under
  `reactCompiler: true` when it is added; `'use no memo'` at the top of a
  file is the escape hatch if a render prop misbehaves (spec §16).

```tsx
'use client'
import { Popover } from '@base-ui/react/popover'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { ICON_SIZE, IconAlert } from '@/lib/icons'

// The shape every popup wrapper takes; a Menu follows the same shape.
export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        data-target=""
        aria-label={label}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
      >
        <IconAlert size={ICON_SIZE.md} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-overlay">
          <Popover.Popup className="popup rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none prose">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

## The gallery

- `app/design/page.tsx` holds `SECTIONS`; each section renders once, at both
  Playwright viewports, with no interaction required to see any state.
- `copy.design.sections.<key>` names it; `id` is kebab-case and becomes the
  section's anchor and `aria-labelledby` target.
- A section file is a server component composed only from primitives and
  tokens; it is the acceptance surface Saman reviews on a phone and a laptop
  (spec §10.3), so it shows the real thing, not a mock.
