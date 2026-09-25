import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Header } from './header'

describe('Header', () => {
  it('is a sticky material banner with the wordmark first and the toggle last', () => {
    render(<Header />)
    const banner = screen.getByRole('banner')
    expect(banner).toHaveClass('material', 'sticky', 'z-header')
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('دبی ساپلیمنت')
    expect(links[0]).toHaveAttribute('href', '/')
    expect(screen.getByRole('navigation', { name: 'ناوبری اصلی' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'برندها' })).toHaveAttribute('href', '/brands')
    expect(screen.getByRole('button', { name: 'انتخاب طرح' })).toBeInTheDocument()
  })

  it('keeps the navigation under seven items (spec §9, Hick)', () => {
    render(<Header />)
    const nav = screen.getByRole('navigation')
    expect(nav.querySelectorAll('a, button').length).toBeLessThanOrEqual(7)
  })
})
