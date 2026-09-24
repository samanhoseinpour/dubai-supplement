import {
  Catch,
  ServiceUnavailableException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'

/**
 * The slice of Fastify's reply this filter drives, typed structurally: the
 * api depends on `@nestjs/platform-fastify`, not on `fastify` itself.
 */
interface HealthReply {
  status(statusCode: number): HealthReply
  send(payload: unknown): unknown
}

/**
 * Terminus's 503, sent as Terminus wrote it.
 *
 * `HealthCheckService.check()` throws `ServiceUnavailableException` carrying
 * `{ status, info, error, details }`, and `details` is the only part of the
 * response that names *which* store is down — which is the entire purpose of
 * `/health/ready`. The global `ProblemFilter` is `@Catch()`, and 503 is absent
 * from its `CODE_BY_STATUS`, so without this filter a readiness failure
 * becomes `{ type: 'urn:problem:INTERNAL', title: 'Internal Server Error',
 * status: 503 }` — a title contradicting its own status, and the diagnosis
 * thrown away.
 *
 * Scoped to the health controller with `@UseFilters`, so every other route
 * keeps the RFC 9457 contract. `ERROR_CODES` stays at nine spec-named codes:
 * `/health/ready`'s consumers are Liara's health checker and a human reading
 * a deploy log, not `@ds/api-client` (ruling of 2026-09-24).
 *
 * Nothing is logged here, on purpose. A readiness 503 is a reported
 * condition, not a bug, and Liara probes on an interval — `ProblemFilter`'s
 * `status >= 500` branch would write one full stack per probe for the length
 * of the outage. Terminus writes its own one-line summary through the Nest
 * logger before it throws, which is the line worth having.
 */
@Catch(ServiceUnavailableException)
export class HealthCheckFilter implements ExceptionFilter {
  catch(exception: ServiceUnavailableException, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<HealthReply>()
    reply.status(exception.getStatus()).send(exception.getResponse())
  }
}
