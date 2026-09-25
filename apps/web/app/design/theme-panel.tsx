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
