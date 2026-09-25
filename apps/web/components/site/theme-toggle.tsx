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
    // Against the stored value, not `current`: an unknown value is shown as
    // «سیستم», and choosing «سیستم» must still replace it.
    if (next === theme) return
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
