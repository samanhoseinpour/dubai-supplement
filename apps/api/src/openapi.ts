import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { AppModule } from './app.module.js'
import { buildDocument } from './shared/openapi/index.js'

/**
 * Boots the app WITHOUT listening and writes the document. Needs a
 * schema-valid env but no live services: pg.Pool connects on first query,
 * ioredis is lazyConnect, the S3 client is lazy (§5.5).
 */
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ logger: false }),
  { logger: false },
)
await app.init()

const target = fileURLToPath(new URL('../openapi.json', import.meta.url))
await writeFile(target, `${JSON.stringify(buildDocument(app), null, 2)}\n`, 'utf8')
await app.close()
