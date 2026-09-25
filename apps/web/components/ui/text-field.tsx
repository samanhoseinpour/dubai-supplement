'use client'

import { Field } from '@base-ui/react/field'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Spec §8.1. Base UI's Field wires label, hint and error to the control
// (`aria-describedby`, `aria-invalid`, `data-invalid`); this file adds the
// tokens. 48 px tall with 16 px text — iOS Safari zooms into anything smaller
// (§6.2). Label above, start-aligned; the error replaces nothing, it is added.
export type TextFieldProps = Omit<ComponentProps<typeof Field.Control>, 'className' | 'render'> & {
  label: string
  hint?: string
  error?: string
  /** Applied to the field's root, not to the input. */
  className?: string
}

export function TextField({ label, hint, error, className, disabled, ...control }: TextFieldProps) {
  const invalid = error !== undefined && error !== ''
  return (
    <Field.Root
      className={cn('flex flex-col gap-2', className)}
      invalid={invalid}
      disabled={disabled}
    >
      <Field.Label className="text-small font-medium text-foreground">{label}</Field.Label>
      <Field.Control
        data-target=""
        className="min-h-12 rounded-md border border-input bg-card px-3 text-body text-foreground focus-ring transition-colors duration-(--duration-quick) ease-out placeholder:text-muted-foreground data-disabled:opacity-50 data-invalid:border-destructive"
        {...control}
      />
      {hint ? (
        <Field.Description className="text-small text-muted-foreground">{hint}</Field.Description>
      ) : null}
      {invalid ? (
        <Field.Error match className="text-small text-destructive">
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  )
}
