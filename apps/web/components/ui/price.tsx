import 'server-only'
import { formatNumber, formatToman } from '@ds/persian'
import { Badge } from '@/components/ui/badge'
import { copy } from '@/lib/copy'
import { cn } from '@/lib/utils'

// Spec §8.1 and §6.4: a raw number cannot reach the page through this
// component. `server-only` keeps the Intl formatting on the server (§7.3).
export type PriceProps = {
  /** IRR minor units — rials — as everywhere in the system. */
  amountMinor: bigint
  /** The pre-discount amount; ignored unless it is higher than `amountMinor`. */
  original?: bigint
  className?: string
}

export function Price({ amountMinor, original, className }: PriceProps) {
  const discounted = original !== undefined && original > amountMinor
  // Integer division truncates on purpose: never promise more than is given.
  const percent = discounted ? ((original - amountMinor) * 100n) / original : 0n

  return (
    <span
      className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums', className)}
    >
      <span className="text-title font-bold text-foreground">{formatToman(amountMinor)}</span>
      {discounted ? (
        <>
          <s className="text-small text-muted-foreground">
            <span className="sr-only">{copy.price.original}: </span>
            {formatToman(original)}
          </s>
          <Badge variant="inverted">
            {formatNumber(percent)}٪ {copy.price.discount}
          </Badge>
        </>
      ) : null}
    </span>
  )
}
