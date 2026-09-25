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
