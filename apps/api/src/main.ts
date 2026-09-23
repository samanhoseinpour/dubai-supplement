import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // nestjs-pino owns logging.
      logger: false,
      // NOT a hop count. Fastify 5.12.5 fails a numeric trustProxy closed —
      // it returns `() => false`, trusting nothing, with no error. Must be a
      // CIDR list or one of proxy-addr's presets (loopback / linklocal /
      // uniquelocal); Fastify splits a string on commas.
      trustProxy: 'loopback,uniquelocal',
      bodyLimit: 1_048_576,
    }),
    { rawBody: true, bufferLogs: true },
  )
  app.useLogger(app.get(Logger))
  app.enableShutdownHooks()
  return app
}

async function bootstrap(): Promise<void> {
  const app = await createApp()
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
}

await bootstrap()
