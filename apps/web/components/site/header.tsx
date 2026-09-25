import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { copy } from '@/lib/copy'
import { Wordmark } from './wordmark'

// Spec §8.1: the material, sticky; wordmark at the start, one link at the
// end. «برندها» targets a route 3c creates; until then it is the not-found
// page, and nothing is deployed before Phase 4. The end slot is otherwise
// empty on purpose: the theme toggle left with ADR-0021, and 3c puts the
// cart there.
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
        </nav>
      </div>
    </header>
  )
}
