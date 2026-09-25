import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import { BrandService, seedBrands } from './modules/catalog/index.js'

/**
 * `node dist/seed.js` (foundation §4.4, §5.7): the module graph main.ts
 * boots, no HTTP server, the relay not started — the outbox rows wait for
 * the API or the worker. Reads apps/api/.env through ConfigModule, so it
 * runs from apps/api, which `pnpm db:seed` guarantees through turbo.
 */
const context = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true })
const logger = context.get(Logger)
context.useLogger(logger)
try {
  const report = await seedBrands(context.get(BrandService))
  logger.log({ msg: 'seed finished', created: report.created, skipped: report.skipped })
} catch (error) {
  logger.error({ err: error, msg: 'seed failed' })
  process.exitCode = 1
} finally {
  await context.close()
}
