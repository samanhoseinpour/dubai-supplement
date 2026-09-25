import { Injectable, Logger } from '@nestjs/common'
import { OnDomainEvent } from '../../../infra/outbox/index.js'
import { BRAND_CREATED } from '../domain/events.js'

/**
 * The first consumer of a domain event (foundation §14 step 5): it proves the
 * outbox delivers `catalog.brand.created` end to end and does nothing else.
 * Idempotent by construction — a line logged twice is not a defect. It is a
 * provider of CatalogModule so OutboxRelay's discovery scan finds it.
 */
@Injectable()
export class BrandCreatedLogger {
  private readonly logger = new Logger(BrandCreatedLogger.name)

  @OnDomainEvent(BRAND_CREATED)
  onBrandCreated(payload: Record<string, unknown>): void {
    this.logger.log({ msg: 'brand created', id: payload['id'], slug: payload['slug'] })
  }
}
