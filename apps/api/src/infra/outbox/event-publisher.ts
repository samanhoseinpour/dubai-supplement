import { Injectable } from '@nestjs/common'
import type { Db } from '../db/index.js'
import { outboxEvents } from './schema.js'

/**
 * `type` follows `<context>.<aggregate>.<past-tense-verb>`, and `payload`
 * carries the aggregate's identity plus the changed fields (§5.6).
 */
export type DomainEvent = {
  type: string
  aggregateType: string
  aggregateId: string
  payload: Record<string, unknown>
  occurredAt: Date
}

/**
 * A port, so application services depend on the interface rather than the
 * table. `tx` is passed explicitly: there is no CLS magic, and the insert
 * must land in the caller's transaction (§6.4).
 */
@Injectable()
export abstract class EventPublisher {
  abstract publish(event: DomainEvent, tx: Db): Promise<void>
}

@Injectable()
export class OutboxEventPublisher extends EventPublisher {
  async publish(event: DomainEvent, tx: Db): Promise<void> {
    // `tx`, never `this.db` — there is no `this.db`. An insert on any other
    // connection commits whether or not the state change it describes does.
    //
    // published_at, attempts and last_error are left to their column
    // defaults rather than named: an absent optional is a key the insert
    // does not carry, which is the pattern every nullable column after this
    // one follows under exactOptionalPropertyTypes.
    await tx.insert(outboxEvents).values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.type,
      payload: event.payload,
      occurredAt: event.occurredAt,
    })
  }
}
