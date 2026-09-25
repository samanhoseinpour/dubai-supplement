import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from './page'

describe('/', () => {
  it('has one h1 and exactly one primary action', () => {
    const { container } = render(<HomePage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
  })
})
