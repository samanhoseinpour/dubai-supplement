import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { AppConfig } from './app-config.js'
import { type Env, EnvSchema } from './env.schema.js'

// The object `validate` produces is the only source AppConfig is built from.
// @nestjs/config writes validated values back to process.env, but only
// strings, numbers and booleans — an array such as CORS_ORIGINS supplied
// through .env never gets there, so a second parse of process.env would
// silently collapse it to []. `forRoot()` runs `validate` synchronously while
// this class is decorated, so `validated` is set before any factory runs.
let validated: Env | undefined
let rejected: unknown

/**
 * The environment `forRoot` validated while this module was decorated — the
 * object the AppConfig provider is built from — for the one consumer that
 * needs it before the container exists: the Fastify adapter's options in
 * the app factory, fixed at instance creation. When `validate` threw, this
 * throws too, with the Zod error as its cause: `forRoot`'s rejection is
 * only surfaced once Nest awaits it, and nothing may be built on a second
 * parse of process.env, whose schema defaults the operator never asked for.
 */
export function validatedEnv(): Env {
  if (validated === undefined) {
    throw new Error('The environment failed validation; nothing can be built from it.', {
      cause: rejected,
    })
  }
  return validated
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: '.env',
      // Zod's own message is more useful than Nest's wrapper, and a boot
      // failure must name the offending key.
      validate: (raw) => {
        try {
          validated = EnvSchema.parse(raw)
        } catch (error) {
          rejected = error
          throw error
        }
        return validated
      },
    }),
  ],
  providers: [
    {
      provide: AppConfig,
      // A failed `validate` rejects the module before any provider is built,
      // so this factory only ever runs on the validated snapshot.
      useFactory: () => new AppConfig(validatedEnv()),
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
