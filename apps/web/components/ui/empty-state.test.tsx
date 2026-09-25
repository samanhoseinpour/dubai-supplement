import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders a level-2 heading by default with the description and the action', () => {
    render(
      <EmptyState
        title="هنوز چیزی اینجا نیست"
        description="به‌زودی"
        action={<button type="button">بازگشت</button>}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'هنوز چیزی اینجا نیست' }),
    ).toBeInTheDocument()
    expect(screen.getByText('به‌زودی')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'بازگشت' })).toBeInTheDocument()
  })

  it('can be the page’s h1', () => {
    render(<EmptyState as="h1" title="صفحه پیدا نشد" />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('hides a decorative icon from assistive technology', () => {
    const { container } = render(<EmptyState title="خالی" icon={<svg data-testid="icon" />} />)
    expect(container.querySelector('[aria-hidden="true"] [data-testid="icon"]')).not.toBeNull()
  })
})
