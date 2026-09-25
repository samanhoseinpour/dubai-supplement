import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { copy, SITE_NAME } from '@/lib/copy'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
}

// The one view that may centre (§6.3) and, like every view, has exactly one
// primary action (§9). The CTA is full-width on a phone and last in its group.
// `Button` marks itself `data-variant`; a link styled through `buttonVariants`
// carries the mark by hand, so the one-primary-action rule stays countable.
export default function HomePage() {
  return (
    <section className="flex flex-col items-start gap-6 py-8">
      <h1 className="text-display font-extrabold prose">{copy.home.headline}</h1>
      <p className="text-lead text-muted-foreground prose">{copy.home.lead}</p>
      <Link
        variant="plain"
        href="/brands"
        data-target=""
        data-variant="primary"
        className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full sm:w-auto')}
      >
        {copy.home.cta}
      </Link>
    </section>
  )
}
