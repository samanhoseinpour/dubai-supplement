import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Surface, surfaceVariants } from './surface'

describe('Surface', () => {
  it('is a bordered card by default', () => {
    const { container } = render(<Surface>محتوا</Surface>)
    expect(container.firstChild).toHaveClass('border', 'bg-card', 'rounded-lg')
  })

  it.each([
    ['raised', 'shadow-sm'],
    ['material', 'material'],
    ['pressable', 'press'],
  ] as const)('the %s variant carries %s', (variant, className) => {
    expect(surfaceVariants({ variant })).toContain(className)
  })
})
