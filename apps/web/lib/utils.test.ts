import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a type-scale size next to a text colour (Review Focus 1)', () => {
    expect(cn('text-body', 'text-foreground')).toBe('text-body text-foreground')
  })

  it('lets a later size win over an earlier one', () => {
    expect(cn('text-small', 'text-body')).toBe('text-body')
    expect(cn('text-title', 'text-title-sm')).toBe('text-title-sm')
  })

  it('merges the design system’s other scales', () => {
    expect(cn('rounded-sm', 'rounded-lg')).toBe('rounded-lg')
    expect(cn('shadow-sm', 'shadow-material')).toBe('shadow-material')
    expect(cn('font-medium', 'font-bold')).toBe('font-bold')
    expect(cn('ease-out', 'ease-in')).toBe('ease-in')
    expect(cn('z-header', 'z-toast')).toBe('z-toast')
  })

  it('keeps logical utilities that do not conflict', () => {
    expect(cn('ps-4', 'pe-2')).toBe('ps-4 pe-2')
  })

  it('accepts clsx-style conditionals', () => {
    expect(cn('px-2', { 'px-4': true, hidden: false })).toBe('px-4')
  })
})
