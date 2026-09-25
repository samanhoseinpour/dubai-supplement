import { Badge } from '@/components/ui/badge'
import { copy } from '@/lib/copy'

export function BadgesSection() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="inverted">{copy.design.samples.badgeNew}</Badge>
      <Badge variant="outline">{copy.design.samples.badgeOut}</Badge>
      <Badge variant="sale">{copy.design.samples.badgeSale}</Badge>
      <Badge variant="success">{copy.design.samples.badgeStock}</Badge>
      <Badge variant="warning">{copy.design.samples.badgeLow}</Badge>
      <Badge variant="destructive">{copy.design.samples.badgeCancelled}</Badge>
    </div>
  )
}
