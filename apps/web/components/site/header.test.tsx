import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Header } from './header'

describe('Header', () => {
  it('is a sticky material banner with the wordmark first and one link', () => {
    render(<Header />)
    const banner = screen.getByRole('banner')
    expect(banner).toHaveClass('material', 'sticky', 'z-header')
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('دبی ساپلیمنت')
    expect(links[0]).toHaveAttribute('href', '/')
    expect(screen.getByRole('navigation', { name: 'ناوبری اصلی' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'برندها' })).toHaveAttribute('href', '/brands')
  })

  it('renders no theme control — there is one theme (ADR-0021)', () => {
    const { container } = render(<Header />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('[aria-haspopup]')).toBeNull()
  })

  it('keeps the navigation under seven items (spec §9, Hick)', () => {
    render(<Header />)
    const nav = screen.getByRole('navigation')
    expect(nav.querySelectorAll('a, button').length).toBeLessThanOrEqual(7)
  })
})
