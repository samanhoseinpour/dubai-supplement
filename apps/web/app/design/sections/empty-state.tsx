import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { copy } from '@/lib/copy'
import { ICON_SIZE, IconEmpty } from '@/lib/icons'

export function EmptyStateSection() {
  return (
    <EmptyState
      icon={<IconEmpty size={ICON_SIZE.lg} />}
      title={copy.design.samples.emptyTitle}
      description={copy.design.samples.emptyBody}
      action={<Button variant="secondary">{copy.design.samples.emptyAction}</Button>}
    />
  )
}
