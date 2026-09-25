import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotFound from './not-found'

describe('not-found', () => {
  it('says what happened and offers the way home', () => {
    const { container } = render(<NotFound />)
    expect(screen.getByRole('heading', { level: 1, name: 'صفحه پیدا نشد' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'بازگشت به صفحهٔ اصلی' })).toHaveAttribute('href', '/')
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
  })
})
