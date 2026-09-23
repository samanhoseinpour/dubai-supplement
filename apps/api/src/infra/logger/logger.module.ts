import { Module, type OnModuleInit } from '@nestjs/common'
import { type AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core'
import { LoggerModule as PinoLoggerModule, type Params } from 'nestjs-pino'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { AppConfig } from '../config/index.js'

const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
]

// Trust an inbound id so a request can be followed across ds-web and
// ds-api; mint one when the storefront did not supply it.
function requestId(req: IncomingMessage): string {
  const header = req.headers['x-request-id']
  const value = Array.isArray(header) ? header[0] : header
  return value && value.length > 0 ? value : randomUUID()
}

export function buildLoggerOptions(config: AppConfig): Params {
  const isProduction = config.nodeEnv === 'production'
  return {
    pinoHttp: {
      level: config.logLevel,
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      // Consulted only for a request that arrives without an id. Under Fastify
      // none does: `request.id` is decided before any middleware runs, and
      // @fastify/middie copies it onto the raw request pino-http sees — which
      // is why `LoggerModule` also hands the same function to Fastify.
      genReqId: requestId,
      ...(isProduction
        ? {}
        : { transport: { target: 'pino-pretty', options: { singleLine: true } } }),
    },
  }
}

/**
 * The one Fastify method this module calls, typed structurally: the api
 * depends on `@nestjs/platform-fastify`, not on `fastify` itself.
 */
interface RequestIdAssignable {
  setGenReqId(fn: (req: IncomingMessage) => string): unknown
}

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => buildLoggerOptions(config),
    }),
  ],
})
export class LoggerModule implements OnModuleInit {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  // Runs during `app.init()`, before the instance is `ready()` — the only
  // window Fastify accepts `setGenReqId` in, and it throws if that ever moves.
  onModuleInit(): void {
    // A worker or a script context has no HTTP adapter and no requests to id;
    // Nest types the host as always populated, which it is not there.
    const adapter = this.adapterHost.httpAdapter as AbstractHttpAdapter | undefined
    if (adapter === undefined) return
    adapter.getInstance<RequestIdAssignable>().setGenReqId(requestId)
  }
}
