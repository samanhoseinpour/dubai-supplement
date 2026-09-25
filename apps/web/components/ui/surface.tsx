import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1. `material` is floating chrome only (§5.5) — never two stacked.
// `pressable` is a whole-card link: use it on a `Link variant="plain"`.
export const surfaceVariants = cva('rounded-lg text-card-foreground', {
  variants: {
    variant: {
      default: 'border bg-card',
      raised:
        'bg-card shadow-sm transition-shadow duration-(--duration-quick) ease-out hover:shadow-md',
      material: 'material text-foreground',
      pressable: 'block press border bg-card focus-ring hover:bg-accent',
    },
  },
  defaultVariants: { variant: 'default' },
})

export type SurfaceProps = ComponentProps<'div'> & VariantProps<typeof surfaceVariants>

export function Surface({ className, variant, ...props }: SurfaceProps) {
  return <div className={cn(surfaceVariants({ variant }), className)} {...props} />
}
