import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1: icon slot, title, one line, one action; centred — one of the two
// places centring is allowed (§6.3). `as="h1"` when it is the page.
export type EmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  as?: 'h1' | 'h2'
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  as: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4 py-12 text-center', className)}>
      {icon ? (
        <div className="text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <Heading className="text-title font-bold">{title}</Heading>
      {description ? <p className="text-body text-muted-foreground prose">{description}</p> : null}
      {action}
    </div>
  )
}
