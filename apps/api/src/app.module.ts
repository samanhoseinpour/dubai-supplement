import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { LoggerModule } from 'nestjs-pino'
import { Redis } from 'ioredis'
import { HealthModule } from './infra/health/health.module.js'

// Spike scope only. Config, validation, errors, security and the data layer
// arrive as their own Phase 2 tasks; this exists to prove Nest 12 ESM boots
// on Fastify with the four packages whose peers were in question.
@Module({
  imports: [
    LoggerModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      storage: new ThrottlerStorageRedisService(
        new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0', {
          lazyConnect: true,
        }),
      ),
    }),
    HealthModule,
  ],
})
export class AppModule {}
