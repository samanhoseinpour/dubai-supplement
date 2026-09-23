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

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: '.env',
      // Zod's own message is more useful than Nest's wrapper, and a boot
      // failure must name the offending key.
      validate: (raw) => {
        validated = EnvSchema.parse(raw)
        return validated
      },
    }),
  ],
  providers: [
    {
      provide: AppConfig,
      // The fallback cannot run today — a failed `validate` rejects the module
      // before any provider is built — and only keeps the provider whole if
      // this module is ever constructed without `forRoot`.
      useFactory: () => new AppConfig(validated ?? EnvSchema.parse(process.env)),
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
