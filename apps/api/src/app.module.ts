import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { Redis } from 'ioredis'
import { AppConfig, ConfigModule } from './infra/config/index.js'
import { DbModule } from './infra/db/index.js'
import { HealthModule } from './infra/health/health.module.js'
import { buildThrottlerOptions } from './infra/http/index.js'
import { LoggerModule } from './infra/logger/index.js'

// Config, logging, the data layer, the global throttler and health.
// Validation, the problem filter and the security plugins are wired in
// main.ts.
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    // @Global() decides who may inject DRIZZLE, not whether the module is
    // built: one import into the root graph is still what instantiates it.
    // Nothing connects here — the pool opens its first client on the first
    // query, which is what lets src/openapi.ts boot with no stores (§5.5).
    DbModule,
    // Until the data layer provides the shared Redis client, the throttler
    // owns a lazily connecting one of its own — built from the validated
    // config, never from process.env. `imports` names where the factory's
    // dependency comes from; the throttler's typing also demands it, because
    // its declarations import `@nestjs/common/interfaces`, a subpath Nest
    // 12's exports map does not expose, so `ModuleMetadata` is `any` there.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        buildThrottlerOptions(new Redis(config.redisUrl, { lazyConnect: true })),
    }),
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
