import { v7 } from 'uuid'

/** UUIDv7: time-ordered, so it clusters in the index rather than scattering. */
export function newId(): string {
  return v7()
}
