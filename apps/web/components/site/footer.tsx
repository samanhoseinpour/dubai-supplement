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
