import { cva, type VariantProps } from 'class-variance-authority'
import NextLink from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1, amended 2026-09-25 (ADR-0020): a text link is the link ink —
// Lapis, 5.82:1 on paper — and always underlined, 1 px, 3 px off the
// baseline, so it is distinguishable without colour; it darkens to the
// foreground on hover. `plain` is for links that look like something else: a
// button (`buttonVariants`), a whole card (`surfaceVariants`), the wordmark.
export const linkVariants = cva('rounded-sm focus-ring', {
  variants: {
    variant: {
      text: 'text-link underline decoration-1 underline-offset-3 transition-colors duration-(--duration-quick) ease-out hover:text-foreground',
      plain: 'no-underline',
    },
  },
  defaultVariants: { variant: 'text' },
})

export type LinkProps = ComponentProps<typeof NextLink> & VariantProps<typeof linkVariants>

export function Link({ className, variant, ...props }: LinkProps) {
  return <NextLink className={cn(linkVariants({ variant }), className)} {...props} />
}
