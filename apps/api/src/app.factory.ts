import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import { AppConfig, validatedEnv } from './infra/config/index.js'
import { buildValidationPipe, ProblemFilter, registerSecurity } from './infra/http/index.js'

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
    new FastifyAdapter({
      // nestjs-pino owns logging.
      logger: false,
      // NOT a hop count. Fastify 5.12.5 fails a numeric trustProxy closed —
      // it returns `() => false`, trusting nothing, with no error. Must be a
      // CIDR list or one of proxy-addr's presets (loopback / linklocal /
      // uniquelocal); Fastify splits a string on commas. The env schema
      // refuses everything else, so what arrives here is one of those.
      trustProxy: config.trustProxy,
      bodyLimit: 1_048_576,
    }),
    { rawBody: true, bufferLogs: true },
  )
  app.useLogger(app.get(Logger))
  await registerSecurity(app, config)
  app.useGlobalPipes(buildValidationPipe())
  app.useGlobalFilters(new ProblemFilter(config.nodeEnv))
  app.enableShutdownHooks()
  return app
}
