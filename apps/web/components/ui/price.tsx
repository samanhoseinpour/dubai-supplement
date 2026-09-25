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
  /** The pre-discount amount; ignored unless the truncated discount is at least 1 %. */
  original?: bigint
  className?: string
}

/**
 * The struck amount and its percentage, or null when there is nothing to
 * show. Integer division truncates on purpose — never promise more than is
 * given — and a discount that truncates to 0 % is no discount: neither a
 * struck price nor a «۰٪» badge (spec §8.1).
 */
function discountOf(
  amountMinor: bigint,
  original: bigint | undefined,
): { original: bigint; percent: bigint } | null {
  if (original === undefined || original <= amountMinor) return null
  const percent = ((original - amountMinor) * 100n) / original
  return percent > 0n ? { original, percent } : null
}

export function Price({ amountMinor, original, className }: PriceProps) {
  const discount = discountOf(amountMinor, original)

  return (
    <span
      className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums', className)}
    >
      <span className="text-title font-bold text-foreground">{formatToman(amountMinor)}</span>
      {discount ? (
        <>
          <s className="text-small text-muted-foreground">
            <span className="sr-only">{copy.price.original}: </span>
            {formatToman(discount.original)}
          </s>
          <Badge variant="sale">
            {formatNumber(discount.percent)}٪ {copy.price.discount}
          </Badge>
        </>
      ) : null}
    </span>
  )
}
