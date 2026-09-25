import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import { ICON_SIZE, IconSpinner } from '@/lib/icons'
import { cn } from '@/lib/utils'

// Spec §8.1. `primary` is the only filled variant. Its `--input` edge is what
// light mode needs (Frozen on paper is 1.87:1, §5.2); in dark mode the same
// edge composites to Frozen over Frozen and vanishes, so no `dark:` variant is
// needed — which also keeps the gallery's forced panels honest (Task 9).
// Sizes start at 44 px — nothing smaller exists (§9, Fitts).
export const buttonVariants = cva(
  'relative inline-flex press items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap focus-ring select-none disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'border border-input bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-foreground underline decoration-1 underline-offset-3 hover:text-muted-foreground',
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
    /** Keeps the label and the focus, swallows clicks, shows the spinner (spec §8.1). */
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
      onClick={loading ? swallow : onClick}
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
