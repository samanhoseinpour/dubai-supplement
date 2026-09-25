import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Link } from './link'

describe('Link', () => {
  it('is underlined by default so colour is never the only cue', () => {
    render(<Link href="/brands">برندها</Link>)
    const link = screen.getByRole('link', { name: 'برندها' })
    expect(link).toHaveAttribute('href', '/brands')
    expect(link).toHaveClass('underline')
  })

  it('is set in the link ink and darkens to the foreground on hover (ADR-0020)', () => {
    render(<Link href="/brands">برندها</Link>)
    const link = screen.getByRole('link')
    expect(link).toHaveClass('text-link', 'hover:text-foreground')
    expect(link).not.toHaveClass('text-foreground', 'hover:text-muted-foreground')
  })

  it('the plain variant carries no underline and merges the caller’s classes', () => {
    render(
      <Link href="/" variant="plain" className="min-h-11">
        خانه
      </Link>,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveClass('no-underline')
    expect(link).toHaveClass('min-h-11')
    expect(link).not.toHaveClass('underline')
  })
})
