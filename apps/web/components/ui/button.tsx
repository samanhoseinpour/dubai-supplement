import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import { ICON_SIZE, IconSpinner } from '@/lib/icons'
import { cn } from '@/lib/utils'

// Spec §8.1, amended 2026-09-25 (ADR-0020). `primary` is the ink as a fill —
// Iris under a paper label, 19.10:1 — so it needs no edge. `secondary` is the
// Lapis 12 % tint under a Lapis label and hovers to the 16 % accent tint;
// `ghost` hovers the same way, so its label turns Lapis on purpose. `link` is
// the link ink, underlined, and darkens to the foreground on hover. Sizes
// start at 44 px — nothing smaller exists (§9, Fitts).
export const buttonVariants = cva(
  'relative inline-flex press items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap focus-ring select-none disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-link underline decoration-1 underline-offset-3 hover:text-foreground',
      },
      size: {
        md: 'min-h-11 px-4 text-body',
        lg: 'min-h-12 px-6 text-body',
        icon: 'size-11',
      },
      block: {
        true: 'flex w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md', block: false },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Keeps the label and the focus, swallows clicks, shows the spinner (spec §8.1).
     * A loading `type="submit"` button is client-only, because the guard it needs is a function.
     */
    loading?: boolean
    /** A leading icon; the spinner takes its place while loading. */
    icon?: ReactNode
  }

function swallow(event: MouseEvent<HTMLButtonElement>) {
  // Belt and braces with `aria-busy:pointer-events-none`: a submit button
  // that is already submitting must not submit twice (Review Focus 5).
  event.preventDefault()
}

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  icon,
  type = 'button',
  onClick,
  children,
  ...props
}: ButtonProps) {
  const hasIcon = icon !== undefined && icon !== null
  return (
    <button
      type={type}
      data-target=""
      data-variant={variant ?? 'secondary'}
      aria-busy={loading || undefined}
      onClick={loading && (onClick !== undefined || type === 'submit') ? swallow : onClick}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {hasIcon ? (
        <span
          className="inline-flex size-5 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {loading ? <IconSpinner className="animate-spin" size={ICON_SIZE.md} /> : icon}
        </span>
      ) : null}
      <span className={cn(loading && !hasIcon && 'opacity-0')}>{children}</span>
      {loading && !hasIcon ? (
        <span
          className="absolute inset-0 inline-flex items-center justify-center"
          aria-hidden="true"
        >
          <IconSpinner className="animate-spin" size={ICON_SIZE.md} />
        </span>
      ) : null}
    </button>
  )
}
