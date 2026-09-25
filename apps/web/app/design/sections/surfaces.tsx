import { Link } from '@/components/ui/link'
import { Surface, surfaceVariants } from '@/components/ui/surface'
import { copy } from '@/lib/copy'

function CardBody() {
  return (
    <div className="flex flex-col gap-1 p-4">
      <p className="text-title-sm font-bold">{copy.design.samples.cardTitle}</p>
      <p className="text-small text-muted-foreground">{copy.design.samples.cardBody}</p>
    </div>
  )
}

export function SurfacesSection() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Surface>
        <CardBody />
      </Surface>
      <Surface variant="raised">
        <CardBody />
      </Surface>
      <Surface variant="material">
        <CardBody />
      </Surface>
      <Link
        variant="plain"
        href="/design#surfaces"
        data-target=""
        className={surfaceVariants({ variant: 'pressable' })}
      >
        <CardBody />
      </Link>
    </div>
  )
}
