import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller.js'
import { OutboxIndicator } from './outbox.indicator.js'
import { PostgresIndicator } from './postgres.indicator.js'
import { RedisIndicator } from './redis.indicator.js'

// The indicators inject DRIZZLE and REDIS, which DbModule and RedisModule
// export from @Global() modules the root graph already imports; nothing is
// imported here for them, and nothing connects until a probe arrives.
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PostgresIndicator, RedisIndicator, OutboxIndicator],
})
export class HealthModule {}
