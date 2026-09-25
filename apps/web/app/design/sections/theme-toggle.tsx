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
