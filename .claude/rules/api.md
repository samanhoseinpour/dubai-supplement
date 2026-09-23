---
paths:
  - 'apps/api/**'
---

# API rules

- **Fastify adapter, not Express.** `@nestjs/platform-express` is banned by
  lint. Adapter options live in one place: `bodyLimit` 1 MiB, `rawBody: true`,
  `trustProxy` from the `TRUST_PROXY` env var, and `logger: false` because
  nestjs-pino owns logging.
- **No `ValidationPipe`, ever.** Validation is the global
  `StandardSchemaValidationPipe` with Zod schemas from `@ds/contracts`, used
  as `@Body({ schema })`, `@Query({ schema })`, `@Param(name, { schema })`.
  No DTO classes, no `class-validator`, no `class-transformer`, no
  `@ApiProperty`.
- **No global prefix and no URI versioning.** Routes are written in full.
- **No `MiddlewareConsumer`.** Use guards, interceptors, or
  `fastify.addHook` — middleware ordering under the Fastify adapter is a
  source of surprises.
- **Terminus:** use `HealthIndicatorService`, not the deprecated
  `HealthIndicator` base class.
- **No `@nestjs/event-emitter`.** Domain events go through the transactional
  outbox (ADR-0009). The import is banned by lint.
- **Tests are Vitest with `app.inject()`.** No supertest, no Jest globals.
- **ESM:** relative imports carry an explicit `.js`. `__dirname` and
  `__filename` are banned by lint — use `import.meta.url`.
