import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton, SkeletonText } from './skeleton'

describe('Skeleton', () => {
  it('is hidden from assistive technology and shimmers', () => {
    const { container } = render(<Skeleton className="h-8" />)
    const skeleton = container.firstChild
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(skeleton).toHaveClass('skeleton')
  })

  it('a circle is fully rounded', () => {
    const { container } = render(<Skeleton shape="circle" className="size-12" />)
    expect(container.firstChild).toHaveClass('rounded-full')
  })

  it('SkeletonText renders the requested number of lines, the last one shorter', () => {
    const { container } = render(<SkeletonText lines={4} />)
    const lines = container.querySelectorAll('.skeleton')
    expect(lines).toHaveLength(4)
    expect(lines[3]).toHaveClass('w-3/4')
  })
})
