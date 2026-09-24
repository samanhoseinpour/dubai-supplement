import { Module, type OnModuleInit } from '@nestjs/common'
import { type AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core'
import { LoggerModule as PinoLoggerModule, type Params } from 'nestjs-pino'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { AppConfig } from '../config/index.js'

// `set-cookie` is live wherever response headers reach pino-http — Fastify's
// stream mode (`lib/reply.js` sets them one by one) and any raw-`setHeader`
// middleware. On Fastify's buffered path they are written with `writeHead`
// and never reach the logger at all, so there is nothing there to leak.
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
]

// A plain token, or nothing: the id is echoed back to the caller (RFC 9457
// `instance`) and searched on, so an oversized or oddly spelt value is
// replaced rather than trusted — it could otherwise be made to collide with
// another request's id, or to carry text a client resolves as a URI.
const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/u

// Trust an inbound id so a request can be followed across ds-web and
// ds-api; mint one when the storefront did not supply a usable one.
function requestId(req: IncomingMessage): string {
  const header = req.headers['x-request-id']
  const value = Array.isArray(header) ? header[0] : header
  return value !== undefined && REQUEST_ID.test(value) ? value : randomUUID()
}

/**
 * The pino-http options `LoggerModule` runs on. On their own they do not
 * deliver the request-id contract: Fastify decides `request.id` before any
 * middleware runs, so `LoggerModule.onModuleInit` has to hand the same
 * function to the adapter. Wiring `PinoLoggerModule.forRoot(buildLoggerOptions(…))`
 * without importing `LoggerModule` silently logs Fastify's `req-N` counter.
 */
export function buildLoggerOptions(config: AppConfig): Params {
  // Pretty output only where a human reads it. Everything else — production,
  // test, any value added later — gets plain JSON, which needs no
  // devDependency: pino-pretty is not installed in a production image.
  const isDevelopment = config.nodeEnv === 'development'
  return {
    pinoHttp: {
      level: config.logLevel,
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      // Consulted only for a request that arrives without an id. Under Fastify
      // none does: `request.id` is decided before any middleware runs, and
      // @fastify/middie copies it onto the raw request pino-http sees — which
      // is why `LoggerModule` also hands the same function to Fastify.
      genReqId: requestId,
      ...(isDevelopment
        ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
        : {}),
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
    //
    // `null`, not `undefined` — measured against @nestjs/core 12.0.4, by
    // resolving HttpAdapterHost out of a `createApplicationContext` graph.
    // While this read `=== undefined` alone, `src/worker.ts` could not boot
    // AppModule at all: `Cannot read properties of null (reading
    // 'getInstance')`, thrown from here during the context's init.
    const adapter = this.adapterHost.httpAdapter as AbstractHttpAdapter | null | undefined
    if (adapter === null || adapter === undefined) return
    adapter.getInstance<RequestIdAssignable>().setGenReqId(requestId)
  }
}
