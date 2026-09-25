import { DirectionProvider } from '@base-ui/react/direction-provider'
import type { ReactNode } from 'react'

// Every provider the shell needs, in one place. Base UI's DirectionProvider
// carries its own `'use client'`, so this file stays a Server Component and
// the shell static (ADR-0006). There is one theme (ADR-0021): nothing here
// reads a preference or sets an attribute before paint.
export function Providers({ children }: { children: ReactNode }) {
  return <DirectionProvider direction="rtl">{children}</DirectionProvider>
}
