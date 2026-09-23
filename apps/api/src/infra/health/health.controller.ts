import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  // Liveness only: the process is up and answering. Readiness (Postgres,
  // Redis, outbox.dead) arrives with the data layer.
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([])
  }
}
