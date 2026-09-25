import { Module } from '@nestjs/common'
import { OutboxModule } from '../../infra/outbox/index.js'
import { BrandsController } from './api/brands.controller.js'
import { BrandCreatedLogger } from './application/brand-created.logger.js'
import { BrandRepository } from './application/brand.repository.js'
import { BrandService } from './application/brand.service.js'
import { DrizzleBrandRepository } from './infrastructure/brand.repository.js'

/**
 * The only file that wires ports to adapters (§5.3). OutboxModule is not
 * global, so it is imported here for EventPublisher; DbModule is, so DRIZZLE
 * needs no import. BrandCreatedLogger is a provider so the relay's discovery
 * scan finds its @OnDomainEvent method.
 */
@Module({
  imports: [OutboxModule],
  controllers: [BrandsController],
  providers: [
    BrandService,
    BrandCreatedLogger,
    { provide: BrandRepository, useClass: DrizzleBrandRepository },
  ],
  exports: [BrandService],
})
export class CatalogModule {}
