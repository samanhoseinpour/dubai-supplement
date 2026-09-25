import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer } from './footer'

describe('Footer', () => {
  it('is a contentinfo landmark carrying the year it is given', () => {
    render(<Footer year="۱۴۰۵" />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('۱۴۰۵')
    expect(footer).toHaveTextContent('همهٔ حقوق محفوظ است')
    expect(footer.textContent).not.toMatch(/[0-9]/)
  })
})
