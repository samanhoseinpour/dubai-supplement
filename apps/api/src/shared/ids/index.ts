import { v7 as uuidv7 } from 'uuid'

/**
 * UUIDv7 for every primary key (ADR-0004): time-ordered, so an index over ids
 * stays append-mostly, and minted here because PostgreSQL 16 has no
 * uuidv7(). This is the whole of shared/ids on purpose — it is a barrel so
 * the `shared-barrel` policy applies to it like every other shared directory.
 */
export function newId(): string {
  return uuidv7()
}
