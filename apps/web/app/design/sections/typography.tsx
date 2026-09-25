import { formatNumber } from '@ds/persian'
import { copy } from '@/lib/copy'

const SCALE = [
  { className: 'text-display font-extrabold', token: 'display' },
  { className: 'text-headline font-bold', token: 'headline' },
  { className: 'text-title font-bold', token: 'title' },
  { className: 'text-title-sm font-bold', token: 'title-sm' },
  { className: 'text-lead', token: 'lead' },
  { className: 'text-body', token: 'body' },
  { className: 'text-small', token: 'small' },
  { className: 'text-caption', token: 'caption' },
] as const

export function TypographySection() {
  return (
    <div className="flex flex-col gap-4">
      {SCALE.map(({ className, token }) => (
        <div key={token} className="flex flex-col gap-1">
          <code dir="ltr" className="text-caption text-muted-foreground">
            {token}
          </code>
          <p className={className}>{copy.design.samples.heading}</p>
        </div>
      ))}
      <p className="text-body prose">{copy.design.samples.paragraph}</p>
      <p className="text-body">{copy.design.samples.brandSentence}</p>
      {/* Tabular digits on the scale — a quantity, because a price reaches the page only through Price (§8.1). */}
      <p className="text-title font-bold tabular-nums">{formatNumber(1_234_567n)}</p>
    </div>
  )
}
