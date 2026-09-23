import { createApp } from './app.factory.js'
import { AppConfig } from './infra/config/index.js'

async function bootstrap(): Promise<void> {
  const app = await createApp()
  await app.listen({ port: app.get(AppConfig).port, host: '0.0.0.0' })
}

await bootstrap()
