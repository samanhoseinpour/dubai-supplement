import { Price } from '@/components/ui/price'

export function PriceSection() {
  return (
    <div className="flex flex-col gap-4">
      <Price amountMinor={28_500_000n} />
      <Price amountMinor={20_000_000n} original={30_000_000n} />
      <Price amountMinor={1_250_000_000n} />
    </div>
  )
}
