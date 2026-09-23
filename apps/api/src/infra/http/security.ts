import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AppConfig } from '../config/index.js'

/**
 * Registered before any app.use(): these are Fastify plugins, not middleware.
 * CORS is registered only when an origin list exists — the storefront talks
 * to this API server-to-server, so the foundation default is no CORS at all.
 */
export async function registerSecurity(
  app: NestFastifyApplication,
  config: AppConfig,
): Promise<void> {
  await app.register(helmet)
  // `parseOptions` doubles as the defaults of every `reply.setCookie`, which
  // makes the cookie rule the path of least resistance: httpOnly, Secure,
  // SameSite=Lax, and never a Domain (north-star §5, security.md).
  await app.register(cookie, {
    parseOptions: { httpOnly: true, secure: true, sameSite: 'lax' },
  })

  if (config.corsOrigins.length > 0) {
    app.enableCors({
      // A copy: the list on the config is the validated snapshot, read-only.
      origin: [...config.corsOrigins],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  }
}
