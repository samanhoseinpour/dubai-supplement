import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Price } from './price'

describe('Price', () => {
  it('formats toman in Persian digits and never emits an ASCII digit (spec §6.4)', () => {
    const { container } = render(<Price amountMinor={28_500_000n} />)
    expect(container.textContent).toContain('۲٬۸۵۰٬۰۰۰ تومان')
    expect(container.textContent).not.toMatch(/[0-9]/)
    expect(container.querySelector('s')).toBeNull()
  })

  it('strikes the original and shows a truncated discount', () => {
    const { container } = render(<Price amountMinor={20_000_000n} original={30_000_000n} />)
    expect(container.querySelector('s')?.textContent).toContain('۳٬۰۰۰٬۰۰۰ تومان')
    expect(container.textContent).toContain('۳۳٪')
    expect(container.textContent).toContain('تخفیف')
    expect(container.textContent).not.toMatch(/[0-9]/)
  })

  it.each([
    ['equal', 28_500_000n],
    ['lower', 20_000_000n],
  ])('shows no discount when the original is %s (Review Focus 4)', (_label, original) => {
    const { container } = render(<Price amountMinor={28_500_000n} original={original} />)
    expect(container.querySelector('s')).toBeNull()
    expect(container.textContent).not.toContain('تخفیف')
    expect(container.textContent).not.toContain('٪')
  })

  it('aligns digits in columns', () => {
    const { container } = render(<Price amountMinor={1n} />)
    expect(container.firstChild).toHaveClass('tabular-nums')
  })
})
