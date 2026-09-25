import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { copy } from '@/lib/copy'
import DesignPage, { metadata } from './page'

const SECTION_COUNT = 10

describe('/design', () => {
  it('is not indexed (D14)', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('shows every section exactly once, in the one theme, under one h1 (ADR-0021)', () => {
    const { container } = render(<DesignPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const sections = [...container.querySelectorAll('section')]
    expect(sections).toHaveLength(SECTION_COUNT)
    expect(new Set(sections.map((section) => section.id)).size).toBe(SECTION_COUNT)
    expect(container.querySelector('[data-panel], [data-theme]')).toBeNull()
    expect(container.querySelector('#theme-toggle')).toBeNull()
  })

  it('shows the six badge variants and every signal token once (§8.1, §5.2)', () => {
    const { container } = render(<DesignPage />)
    const badges = container.querySelector('#badges')
    for (const marker of [
      'bg-foreground',
      'border-input',
      'bg-sale',
      'bg-success-soft',
      'bg-warning-soft',
      'bg-destructive-soft',
    ]) {
      expect(badges?.querySelectorAll(`.${marker}`), marker).toHaveLength(1)
    }
    const { badgeSale, badgeLow, badgeCancelled } = copy.design.samples
    for (const text of [badgeSale, badgeLow, badgeCancelled]) {
      expect(badges?.textContent, text).toContain(text)
    }

    const swatches = [...container.querySelectorAll('#colors li')]
    const named = (token: string) =>
      swatches.find((li) => li.querySelector('code')?.textContent === token)
    for (const token of [
      'destructive-soft',
      'sale',
      'success',
      'success-soft',
      'warning',
      'warning-soft',
    ]) {
      expect(named(token), token).toHaveClass(`bg-${token}`)
    }
    // The primary is the ink and needs no edge; the link ink sits on the card.
    expect(named('primary')).not.toHaveClass('border-input')
    expect(named('link')).toHaveClass('bg-card')
    expect(named('link')?.querySelector('code')).toHaveClass('text-link')
  })

  it('marks every control as a target, except links inside running text', () => {
    const { container } = render(<DesignPage />)
    const controls = [...container.querySelectorAll('button, input, a[href]')]
    const unmarked = controls.filter(
      (el) => !el.hasAttribute('data-target') && el.closest('p') === null,
    )
    expect(unmarked).toEqual([])
  })

  it('shows the loading, disabled and error states without interaction (§10.3)', () => {
    const { container } = render(<DesignPage />)
    expect(container.querySelectorAll('button[aria-busy="true"]').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('button:disabled').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('input[aria-invalid="true"]').length).toBeGreaterThanOrEqual(
      1,
    )
  })
})
