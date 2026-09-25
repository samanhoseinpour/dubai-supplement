// Token names are code identifiers, shown in Latin on purpose and marked ltr.
const SWATCHES = [
  { token: 'background', surface: 'bg-background border', ink: 'text-foreground' },
  { token: 'card', surface: 'bg-card border', ink: 'text-card-foreground' },
  { token: 'primary', surface: 'bg-primary', ink: 'text-primary-foreground' },
  { token: 'secondary', surface: 'bg-secondary', ink: 'text-secondary-foreground' },
  { token: 'muted', surface: 'bg-muted', ink: 'text-muted-foreground' },
  { token: 'accent', surface: 'bg-accent', ink: 'text-accent-foreground' },
  { token: 'destructive', surface: 'bg-destructive', ink: 'text-destructive-foreground' },
  { token: 'destructive-soft', surface: 'bg-destructive-soft', ink: 'text-destructive' },
  { token: 'sale', surface: 'bg-sale', ink: 'text-sale-foreground' },
  { token: 'success', surface: 'bg-success', ink: 'text-success-foreground' },
  { token: 'success-soft', surface: 'bg-success-soft', ink: 'text-success' },
  { token: 'warning', surface: 'bg-warning', ink: 'text-warning-foreground' },
  { token: 'warning-soft', surface: 'bg-warning-soft', ink: 'text-warning' },
] as const

// The tokens with no surface of their own, shown on the card: the two edges,
// the ring, and the link ink.
const EDGES = [
  { token: 'border', className: 'border', ink: 'text-foreground' },
  { token: 'input', className: 'border border-input', ink: 'text-foreground' },
  {
    token: 'ring',
    className: 'outline outline-2 outline-offset-2 outline-ring',
    ink: 'text-foreground',
  },
  {
    token: 'link',
    className: 'border',
    ink: 'text-link underline decoration-1 underline-offset-3',
  },
] as const

export function ColorsSection() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SWATCHES.map(({ token, surface, ink }) => (
          <li
            key={token}
            className={`flex min-h-20 flex-col justify-end rounded-md p-3 ${surface}`}
          >
            <code dir="ltr" className={`text-caption font-medium ${ink}`}>
              {token}
            </code>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-3">
        {EDGES.map(({ token, className, ink }) => (
          <li key={token} className={`rounded-md bg-card px-3 py-2 ${className}`}>
            <code dir="ltr" className={`text-caption font-medium ${ink}`}>
              {token}
            </code>
          </li>
        ))}
      </ul>
    </div>
  )
}
