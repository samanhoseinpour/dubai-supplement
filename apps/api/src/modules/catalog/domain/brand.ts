import { normalizePersian } from '@ds/persian'
import { newId } from '../../../shared/ids/index.js'

export const SLUG_PATTERN = /^[a-z0-9-]+$/u
export const SLUG_MAX = 64
export const NAME_MAX = 200
export const DESCRIPTION_MAX = 2000

export type BrandProps = {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly description: string | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type CreateBrandInput = {
  readonly slug: string
  readonly name: string
  readonly description?: string
}

/**
 * An input that violates a Brand invariant. Only the seed and tests can
 * raise it — there is no write route (§5.7) — so it is a plain Error, not an
 * AppError with a wire code.
 */
export class InvalidBrandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidBrandError'
  }
}

/**
 * The aggregate (foundation §5.7). Persian text is normalised here, on write
 * (persian.md): trimmed, Arabic ي/ك turned into ی/ک, digits into ASCII — and
 * a ZWNJ inside a word survives, because normalizePersian never touches U+200C.
 * Limits count code points, like the contract does, so a ZWNJ costs one.
 */
export class Brand {
  private constructor(private readonly props: BrandProps) {}

  static create(input: CreateBrandInput, now: Date = new Date()): Brand {
    const { slug } = input
    if (!SLUG_PATTERN.test(slug) || slug.length > SLUG_MAX) {
      throw new InvalidBrandError(
        `slug must be lowercase Latin letters, digits and hyphens, at most ${String(SLUG_MAX)} characters`,
      )
    }
    const name = normalizePersian(input.name)
    if (!withinLimit(name, NAME_MAX)) {
      throw new InvalidBrandError(
        `name must be 1 to ${String(NAME_MAX)} code points after normalisation`,
      )
    }
    const description =
      input.description === undefined ? undefined : normalizePersian(input.description)
    if (description !== undefined && !withinLimit(description, DESCRIPTION_MAX)) {
      throw new InvalidBrandError(
        `description must be 1 to ${String(DESCRIPTION_MAX)} code points after normalisation`,
      )
    }
    return new Brand({ id: newId(), slug, name, description, createdAt: now, updatedAt: now })
  }

  /** A row read back: normalised when it was written, so nothing runs again. */
  static rehydrate(props: BrandProps): Brand {
    return new Brand(props)
  }

  get id(): string {
    return this.props.id
  }
  get slug(): string {
    return this.props.slug
  }
  get name(): string {
    return this.props.name
  }
  get description(): string | undefined {
    return this.props.description
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }
}

function withinLimit(text: string, max: number): boolean {
  const length = Array.from(text).length
  return length >= 1 && length <= max
}
