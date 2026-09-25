import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
