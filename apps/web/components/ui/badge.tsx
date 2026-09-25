import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1, amended 2026-09-25. Solid chips demand attention: `sale` is the
// discount chip in the one red a view carries (§9), and `inverted` — the ink
// on the page — is the Von Restorff chip for the one other thing to notice.
// Soft chips report state: the signal ink on its own 12 % tint, so stock, a
// warning and a cancellation read as facts, not as calls for attention.
// `outline` is the quiet default.
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        inverted: 'bg-foreground text-background',
        outline: 'border border-input text-foreground',
        sale: 'bg-sale text-sale-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        destructive: 'bg-destructive-soft text-destructive',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
)

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
