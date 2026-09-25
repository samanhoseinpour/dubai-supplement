import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './badge'

describe('Badge', () => {
  // Solid chips demand attention; soft chips report state on the ink's own
  // 12 % tint (spec §8.1, amended 2026-09-25).
  it.each([
    ['inverted', 'bg-foreground'],
    ['outline', 'border-input'],
    ['sale', 'bg-sale'],
    ['success', 'bg-success-soft'],
    ['warning', 'bg-warning-soft'],
    ['destructive', 'bg-destructive-soft'],
  ] as const)('the %s variant carries %s at caption size, weight 600', (variant, className) => {
    render(<Badge variant={variant}>جدید</Badge>)
    const badge = screen.getByText('جدید')
    expect(badge).toHaveClass(className, 'text-caption', 'font-semibold')
  })
})
