import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './badge'

describe('Badge', () => {
  it.each([
    ['inverted', 'bg-foreground'],
    ['outline', 'border-input'],
    ['destructive', 'bg-destructive'],
  ] as const)('the %s variant carries %s at caption size, weight 600', (variant, className) => {
    render(<Badge variant={variant}>جدید</Badge>)
    const badge = screen.getByText('جدید')
    expect(badge).toHaveClass(className, 'text-caption', 'font-semibold')
  })
})
