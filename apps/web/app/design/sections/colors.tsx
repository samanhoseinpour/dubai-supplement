// Token names are code identifiers, shown in Latin on purpose and marked ltr.
const SWATCHES = [
  { token: 'background', surface: 'bg-background border', ink: 'text-foreground' },
  { token: 'card', surface: 'bg-card border', ink: 'text-card-foreground' },
  { token: 'primary', surface: 'bg-primary border border-input', ink: 'text-primary-foreground' },
  { token: 'secondary', surface: 'bg-secondary', ink: 'text-secondary-foreground' },
  { token: 'muted', surface: 'bg-muted', ink: 'text-muted-foreground' },
  { token: 'accent', surface: 'bg-accent', ink: 'text-accent-foreground' },
  { token: 'destructive', surface: 'bg-destructive', ink: 'text-destructive-foreground' },
] as const

const EDGES = [
  { token: 'border', className: 'border' },
  { token: 'input', className: 'border border-input' },
  { token: 'ring', className: 'outline outline-2 outline-offset-2 outline-ring' },
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
        {EDGES.map(({ token, className }) => (
          <li key={token} className={`rounded-md bg-card px-3 py-2 ${className}`}>
            <code dir="ltr" className="text-caption font-medium text-foreground">
              {token}
            </code>
          </li>
        ))}
      </ul>
    </div>
  )
}
