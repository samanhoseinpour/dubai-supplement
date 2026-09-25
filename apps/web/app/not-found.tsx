import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Link } from '@/components/ui/link'
import { copy } from '@/lib/copy'
import { ICON_SIZE, IconEmpty } from '@/lib/icons'

export default function NotFound() {
  return (
    <EmptyState
      as="h1"
      icon={<IconEmpty size={ICON_SIZE.lg} />}
      title={copy.errors.notFoundTitle}
      description={copy.errors.notFoundBody}
      action={
        <Link
          variant="plain"
          href="/"
          data-target=""
          // A link styled as the primary button carries the mark `Button` would set.
          data-variant="primary"
          className={buttonVariants({ variant: 'primary' })}
        >
          {copy.actions.backHome}
        </Link>
      }
    />
  )
}
