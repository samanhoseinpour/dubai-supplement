import { SetMetadata } from '@nestjs/common'

export const ON_DOMAIN_EVENT = 'ds:on-domain-event'

/**
 * Marks a provider method as a handler for one domain event type (§5.6).
 * The relay discovers it at startup; nothing subscribes at runtime, and
 * `@nestjs/event-emitter` is banned by lint because delivery has to survive
 * the process that published the event.
 *
 * Handlers must be idempotent: delivery is at-least-once, and a handler that
 * fails after a side effect repeats that side effect on the retry.
 */
export const OnDomainEvent = (type: string): MethodDecorator => SetMetadata(ON_DOMAIN_EVENT, type)
