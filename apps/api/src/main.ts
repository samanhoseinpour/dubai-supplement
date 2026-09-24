import { createApp } from './app.factory.js'
import { AppConfig } from './infra/config/index.js'
import { OutboxRelay } from './infra/outbox/index.js'

async function bootstrap(): Promise<void> {
  const app = await createApp()
  const config = app.get(AppConfig)
  // `all` is one container doing both jobs: the HTTP app and the relay in the
  // same DI container, over the same pool (§5.2). Under `api` the relay is
  // left to a separate worker process. `worker` never reaches here — it is
  // `dist/worker.js` that a worker container runs — and the relay stays
  // stopped if it somehow does, rather than a misconfigured api container
  // quietly becoming a second consumer of the outbox.
  if (config.processRole === 'all') {
    app.get(OutboxRelay).start()
  }
  await app.listen({ port: config.port, host: '0.0.0.0' })
}

await bootstrap()
