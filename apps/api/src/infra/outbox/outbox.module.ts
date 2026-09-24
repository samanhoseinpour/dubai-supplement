import { Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'
import { EventPublisher, OutboxEventPublisher } from './event-publisher.js'
import { OutboxRelay } from './outbox.relay.js'

/**
 * DiscoveryModule is what supplies DiscoveryService and MetadataScanner to
 * the relay; Reflector is global. AppConfig and DRIZZLE come from the
 * @Global() ConfigModule and DbModule, which the importing graph provides.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [OutboxRelay, { provide: EventPublisher, useClass: OutboxEventPublisher }],
  exports: [OutboxRelay, EventPublisher],
})
export class OutboxModule {}
