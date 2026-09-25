import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

// `Button` is a plain function: calling it returns the `<button>` element whose
// props a Server Component would have to serialise.
type ButtonElement = ReactElement<{ onClick?: unknown }>

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'destructive', 'link'] as const)(
    'renders the %s variant as a marked target of type button',
    (variant) => {
      render(<Button variant={variant}>ادامه</Button>)
      const button = screen.getByRole('button', { name: 'ادامه' })
      expect(button).toHaveAttribute('data-variant', variant)
      expect(button).toHaveAttribute('data-target')
      expect(button).toHaveAttribute('type', 'button')
    },
  )

  it('is secondary by default — primary is a choice, one per view (spec §9)', () => {
    render(<Button>ادامه</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'secondary')
  })

  it.each([
    ['md', 'min-h-11'],
    ['lg', 'min-h-12'],
    ['icon', 'size-11'],
  ] as const)('the %s size is at least 44 px', (size, className) => {
    render(
      <Button size={size} aria-label="بستن">
        ×
      </Button>,
    )
    expect(screen.getByRole('button')).toHaveClass(className)
  })

  it('keeps the label, stays focusable and swallows clicks while loading (Review Focus 5)', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        ثبت سفارش
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'ثبت سفارش' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).not.toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('replaces the icon with the spinner while loading, and restores it after', () => {
    const { rerender, container } = render(
      <Button loading icon={<svg data-testid="icon" />}>
        ادامه
      </Button>,
    )
    expect(screen.queryByTestId('icon')).toBeNull()
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    rerender(<Button icon={<svg data-testid="icon" />}>ادامه</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeNull()
  })

  it('without an icon, keeps the label in the document at opacity 0 under the spinner', () => {
    const { container } = render(<Button loading>ادامه</Button>)
    expect(screen.getByRole('button', { name: 'ادامه' })).toBeInTheDocument()
    expect(screen.getByText('ادامه')).toHaveClass('opacity-0')
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('passes disabled through', () => {
    render(<Button disabled>ادامه</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders a loading button without a handler as a plain element a Server Component can pass (no function props)', () => {
    const element = Button({ loading: true, children: 'ادامه' }) as ButtonElement
    expect(element.props.onClick).toBeUndefined()
  })

  it('still guards a loading submit button', () => {
    const element = Button({ loading: true, type: 'submit', children: 'ثبت' }) as ButtonElement
    expect(typeof element.props.onClick).toBe('function')
  })
})
