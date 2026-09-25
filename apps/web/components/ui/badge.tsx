import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1. `inverted` is the Von Restorff chip — Iris on light, Frozen on
// dark, because it is `--foreground` on `--background` — reserved for the one
// thing to notice in a view (§9).
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        inverted: 'bg-foreground text-background',
        outline: 'border border-input text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
)

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
