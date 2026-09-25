import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1. Decorative: hidden from assistive technology; the `skeleton`
// utility shimmers at 0.6 Hz and goes static under reduced motion (§7.2, §7.4).
export type SkeletonProps = ComponentProps<'div'> & { shape?: 'block' | 'line' | 'circle' }

export function Skeleton({ className, shape = 'block', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton',
        shape === 'circle' ? 'rounded-full' : 'rounded-sm',
        shape === 'line' && 'h-4 w-full',
        className,
      )}
      {...props}
    />
  )
}

/** A paragraph-shaped fallback for a Suspense island. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} shape="line" className={index === lines - 1 ? 'w-3/4' : undefined} />
      ))}
    </div>
  )
}
