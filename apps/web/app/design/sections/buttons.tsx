import { Button } from '@/components/ui/button'
import { copy } from '@/lib/copy'
import { ICON_SIZE, IconClose, IconForward } from '@/lib/icons'

const VARIANTS = ['primary', 'secondary', 'ghost', 'destructive', 'link'] as const

export function ButtonsSection() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {copy.actions.addToCart}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg">
          {copy.actions.addToCart}
        </Button>
        <Button variant="primary" icon={<IconForward size={ICON_SIZE.md} />}>
          {copy.design.states.withIcon}
        </Button>
        <Button variant="secondary" size="icon" aria-label={copy.actions.close}>
          <IconClose size={ICON_SIZE.md} />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled>
          {copy.design.states.disabled}
        </Button>
        <Button variant="secondary" disabled>
          {copy.design.states.disabled}
        </Button>
        <Button variant="primary" loading>
          {copy.design.states.loading}
        </Button>
        <Button variant="secondary" loading icon={<IconForward size={ICON_SIZE.md} />}>
          {copy.design.states.loading}
        </Button>
      </div>
      <Button variant="primary" block>
        {copy.design.states.block}
      </Button>
    </div>
  )
}
