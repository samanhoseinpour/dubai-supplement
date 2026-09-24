---
paths:
  - 'apps/api/**'
---

# API rules

- **Fastify adapter, not Express.** `@nestjs/platform-express` is banned by
  lint. Adapter options live in one place: `bodyLimit` 1 MiB, `rawBody: true`,
  `trustProxy` from the `TRUST_PROXY` env var, and `logger: false` because
  nestjs-pino owns logging.
- **`trustProxy` is never a number.** Fastify 5.12.5 fails a numeric
  `trustProxy` closed — it returns `() => false` and trusts nothing, with no
  error, so `req.ip` silently becomes the socket peer and every client behind
  the proxy shares one throttle bucket. Use a CIDR list or one of
  proxy-addr's presets (`loopback`, `linklocal`, `uniquelocal`), comma
  separated. TypeScript will also reject a number — do not cast past it.
- **No `ValidationPipe`, ever.** Validation is the global
  `StandardSchemaValidationPipe` with Zod schemas from `@ds/contracts`, used
  as `@Body({ schema })`, `@Query({ schema })`, `@Param(name, { schema })`.
  No DTO classes, no `class-validator`, no `class-transformer`, no
  `@ApiProperty`.
- **No global prefix and no URI versioning.** Routes are written in full.
- **No `MiddlewareConsumer`.** Use guards, interceptors, or
  `fastify.addHook` — middleware ordering under the Fastify adapter is a
  source of surprises.
- **Terminus:** use `HealthIndicatorService`. The `HealthIndicator` base class
  and `HealthCheckError` were **removed** in terminus 12 — not deprecated, so
  code written against them will not compile. `status` is a reserved key in the
  detail object; passing it is a type error.
- **`ValidationError` is ours**, from `src/shared/errors`. `@nestjs/common`
  exports an unrelated `ValidationError` _interface_ — if the editor
  auto-imports it, `new ValidationError(...)` will not compile.
- **No `@nestjs/event-emitter`.** Domain events go through the transactional
  outbox (ADR-0009). The import is banned by lint.
- **Tests are Vitest with `app.inject()`.** No supertest, no Jest globals.
- **ESM:** relative imports carry an explicit `.js`. `__dirname` and
  `__filename` are banned by lint — use `import.meta.url`.
- **The Swagger UI's CSP is verified in a browser, never by `pnpm check`.**
  `app.inject()` cannot see a browser-side CSP block, so the inject test only
  pins that `@nestjs/swagger`'s template has no inline script or handler.
  After any `swagger-ui-dist` or `@nestjs/swagger` bump, with the stack up and
  `apps/api/.env` present, run from `apps/api`:
  `pnpm --filter api build && node test/manual/csp/check.mjs`. It boots the
  built app, loads `/docs` in headless Chrome over CDP, exercises "Try it out"
  and fails on any refusal; `--control` forces `script-src 'none'` onto the
  page and must report refusals, or the detector itself is broken.
