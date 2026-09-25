import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import { AppConfig, validatedEnv } from './infra/config/index.js'
import { buildValidationPipe, ProblemFilter, registerSecurity } from './infra/http/index.js'
import { buildDocument } from './shared/openapi/index.js'

/**
 * The largest request body the API accepts — 1 MiB, which is also Fastify
 * 5's own default. It is restated because it is this API's policy
 * (`.claude/rules/api.md`) rather than the library's: a Fastify release that
 * changes its default, or a hand that drops the line, changes what the API
 * accepts and what `problem.filter.ts` answers 413 to.
 */
export const BODY_LIMIT_BYTES = 1_048_576

/**
 * The longest path parameter Fastify's router hands on to Nest, in place of
 * find-my-way's default of 100 — why, on the `routerOptions` line of
 * `adapterOptions`. A parameter longer than this is still refused by the
 * router with a bare 414.
 */
export const MAX_PARAM_LENGTH = 8192

/**
 * The slice of the adapter's options this API fixes, typed structurally: the
 * api depends on `@nestjs/platform-fastify`, not on `fastify` itself, so its
 * option types are not importable here — the same reason `problem.filter.ts`
 * types its reply and `logger.module.ts` types `setGenReqId`.
 */
interface AdapterOptions {
  logger: false
  trustProxy: string
  bodyLimit: number
  routerOptions: { maxParamLength: number }
}

/**
 * Every adapter option in one place (`.claude/rules/api.md`), and in one
 * object so a test can assert all of it at once.
 *
 * Be precise about what that buys, because an earlier version of this comment
 * was not. `trustProxy` and `rawBody` change what a request does, so requests
 * tie them to the running app. `bodyLimit` does not: 1 MiB **is** Fastify's
 * own default, so no request can distinguish setting it from omitting it —
 * that is the `pool.max` defect, where an assertion matching the library's
 * default passes against code that ignores its configuration.
 *
 * Measured, not assumed: building production's adapter from a literal with no
 * `bodyLimit` leaves the whole integration suite green, 18 files and 127
 * tests. So this object is what guards the line — deleting it fails the
 * whole-object assertion — and the line's presence in the *running* adapter
 * is not provable by request while the value equals the default. Making it
 * provable needs a deliberate rewrite, not a cleverer assertion.
 */
export function adapterOptions(config: AppConfig): AdapterOptions {
  return {
    // nestjs-pino owns logging.
    logger: false,
    // NOT a hop count. Fastify 5.12.5 fails a numeric trustProxy closed —
    // it returns `() => false`, trusting nothing, with no error. Must be a
    // CIDR list or one of proxy-addr's presets (loopback / linklocal /
    // uniquelocal); Fastify splits a string on commas. The env schema
    // refuses everything else, so what arrives here is one of those.
    trustProxy: config.trustProxy,
    bodyLimit: BODY_LIMIT_BYTES,
    // A malformed path parameter must be a 400 problem naming it, which
    // needs it to reach the validation pipe. find-my-way refuses one longer
    // than `maxParamLength` inside the router instead, where Fastify writes a
    // bare `414 application/json` before Nest's pipe or ProblemFilter runs.
    // Its default of 100 protects nothing here — Node's HTTP parser already
    // bounds the request line — and would only bypass ProblemFilter for any
    // slug past 100 characters (catalog-http.test.ts sends 101).
    routerOptions: { maxParamLength: MAX_PARAM_LENGTH },
  }
}

/**
 * Everything main.ts boots, short of listening — its own module so a test
 * can exercise the production wiring; main.ts's top-level `await bootstrap()`
 * would listen on import.
 */
export async function createApp(): Promise<NestFastifyApplication> {
  // The adapter's options are fixed before the container exists, so this is
  // built from the same validated snapshot the AppConfig provider is.
  const config = new AppConfig(validatedEnv())
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(adapterOptions(config)),
    // `rawBody: true` makes Nest install the content-type parsers that keep
    // the request's bytes on `req.rawBody`. Nothing in Phase 2 reads them;
    // the first signature-verifying webhook will, and a body already parsed
    // and discarded cannot be recovered after the fact.
    { rawBody: true, bufferLogs: true },
  )
  app.useLogger(app.get(Logger))
  await registerSecurity(app, config)
  app.useGlobalPipes(buildValidationPipe())
  app.useGlobalFilters(new ProblemFilter(config.nodeEnv))
  // Development only (`.env.example` sets it, production never does): the UI
  // and its assets at /docs, the document at /docs-json. Under helmet's
  // default CSP as registered above — measured, not assumed: the page's
  // bootstrap is an external same-origin script and Nest inlines the spec,
  // so nothing needs relaxing (Task 9).
  if (config.openapiUiEnabled) {
    SwaggerModule.setup('docs', app, buildDocument(app))
  }
  app.enableShutdownHooks()
  return app
}
