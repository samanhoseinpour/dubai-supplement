import type { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import { OutboxRelay } from './infra/outbox/index.js'

/**
 * No HTTP server: createApplicationContext only (§5.2).
 *
 * The same module graph `main.ts` boots — one config, one pool, one Redis
 * client — with nothing listening and the relay polling. `useLogger` is what
 * makes `bufferLogs` pay: without it the buffer drains into Nest's console
 * logger, and the relay's `outbox cycle failed` line — the sole symptom of a
 * transaction-level failure (§5.6) — would leave a worker container as
 * unstructured text at a level `LOG_LEVEL` does not govern. `app.factory.ts`
 * installs the same logger for the same reason.
 */
export async function bootstrapWorker(): Promise<INestApplicationContext> {
  const context = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true })
  context.useLogger(context.get(Logger))
  context.enableShutdownHooks()
  context.get(OutboxRelay).start()
  return context
}

// The entrypoint half of this file, and an interlock: `node dist/worker.js`
// boots a relay only where the environment says this container is a worker,
// so a deploy that points the wrong app at the wrong entrypoint runs nothing
// rather than running a second relay nobody expected. Importing the module —
// which the test does — therefore boots nothing.
if (process.env.PROCESS_ROLE === 'worker') {
  await bootstrapWorker()
}
