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
