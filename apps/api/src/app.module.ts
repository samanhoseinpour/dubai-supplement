import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import type { Redis } from 'ioredis'
import { ConfigModule } from './infra/config/index.js'
import { DbModule } from './infra/db/index.js'
import { HealthModule } from './infra/health/index.js'
import { buildThrottlerOptions } from './infra/http/index.js'
import { LoggerModule } from './infra/logger/index.js'
import { OutboxModule } from './infra/outbox/index.js'
import { REDIS, RedisModule } from './infra/redis/index.js'
import { StorageModule } from './infra/storage/index.js'
import { CatalogModule } from './modules/catalog/index.js'

// Config, logging, the data layer, the outbox relay, Redis, object storage,
// the global throttler, health and the catalog context. Validation, the
// problem filter and the security plugins are wired in app.factory.ts.
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    // @Global() decides who may inject DRIZZLE, not whether the module is
    // built: one import into the root graph is still what instantiates it.
    // Nothing connects here — the pool opens its first client on the first
    // query, which is what lets src/openapi.ts boot with no stores (§5.5).
    DbModule,
    // Same reasoning, and the same lazy story: the client ioredis builds here
    // opens no socket until a command runs, and the S3 client opens none
    // until a command runs.
    RedisModule,
    StorageModule,
    // The relay's onModuleInit only scans providers for @OnDomainEvent
    // handlers; nothing polls until start() is called, which Task 16 owns per
    // PROCESS_ROLE. Importing it here is what makes the handler map, the
    // EventPublisher and the outbox_events table reachable from a booted
    // AppModule at all.
    OutboxModule,
    // One Redis client for the whole process. RedisModule builds it, closes
    // it on shutdown, and hands the same instance to the KeyValueStore and to
    // the throttler storage — this factory used to construct a second client
    // of its own that nothing ever closed.
    // `imports` names where the factory's dependency comes from; the
    // throttler's typing also demands it, because its declarations import
    // `@nestjs/common/interfaces`, a subpath Nest 12's exports map does not
    // expose, so `ModuleMetadata` is `any` there.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS],
      useFactory: (redis: Redis) => buildThrottlerOptions(redis),
    }),
    HealthModule,
    // The first bounded context (§5.7). Its repository holds the pool's
    // token and opens nothing at boot, so src/openapi.ts still boots dry.
    CatalogModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
