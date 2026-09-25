import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextField } from './text-field'

describe('TextField', () => {
  it('associates the label and describes the input by its hint', () => {
    render(<TextField label="شمارهٔ موبایل" hint="با ۰۹ شروع می‌شود" />)
    const input = screen.getByLabelText('شمارهٔ موبایل')
    const hint = screen.getByText('با ۰۹ شروع می‌شود')
    expect(hint.id).not.toBe('')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(hint.id)
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('an error marks the input invalid and is announced with the hint', () => {
    render(<TextField label="شمارهٔ موبایل" hint="راهنما" error="شمارهٔ موبایل معتبر نیست" />)
    const input = screen.getByLabelText('شمارهٔ موبایل')
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(ids).toContain(screen.getByText('شمارهٔ موبایل معتبر نیست').id)
    expect(ids).toContain(screen.getByText('راهنما').id)
  })

  it('is 48 px tall, 16 px text, with the control boundary, and a marked target', () => {
    render(<TextField label="نام" />)
    const input = screen.getByLabelText('نام')
    expect(input).toHaveClass('min-h-12', 'text-body', 'border-input')
    expect(input).toHaveAttribute('data-target')
  })

  it('passes inputMode and disabled through', () => {
    render(<TextField label="کد پستی" inputMode="numeric" disabled />)
    const input = screen.getByLabelText('کد پستی')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toBeDisabled()
  })
})
