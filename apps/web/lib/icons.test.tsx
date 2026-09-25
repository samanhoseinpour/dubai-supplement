import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { ICON_SIZE, IconBack, IconForward, IconSpinner } from './icons'

function pathOf(element: ReactElement): string | null {
  const { container } = render(element)
  return container.querySelector('path')?.getAttribute('d') ?? null
}

describe('lib/icons', () => {
  it('IconForward points left — forward is left in a right-to-left store (spec §8.2)', () => {
    expect(pathOf(<IconForward />)).toBe('m15 18-6-6 6-6')
  })

  it('IconBack points right', () => {
    expect(pathOf(<IconBack />)).toBe('m9 18 6-6-6-6')
  })

  it('renders at the three sizes', () => {
    const { container } = render(<IconSpinner size={ICON_SIZE.lg} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '24')
    expect(ICON_SIZE).toEqual({ sm: 16, md: 20, lg: 24 })
  })
})
