import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { AppConfig } from './app-config.js'
import { EnvSchema } from './env.schema.js'

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: '.env',
      // Zod's own message is more useful than Nest's wrapper, and a boot
      // failure must name the offending key.
      validate: (raw) => EnvSchema.parse(raw),
    }),
  ],
  providers: [
    {
      provide: AppConfig,
      // No `inject` is needed for ordering: `forRoot()` above loads `.env`
      // into `process.env` synchronously while this class is decorated, long
      // before any factory runs. (A module class is not an injectable token
      // outside its own module, so `inject: [NestConfigModule]` cannot
      // resolve — Nest 12 answers "can't resolve dependencies of AppConfig".)
      useFactory: () => new AppConfig(EnvSchema.parse(process.env)),
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
