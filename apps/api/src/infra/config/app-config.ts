import { Injectable } from '@nestjs/common'
import type { Env } from './env.schema.js'

@Injectable()
export class AppConfig {
  readonly nodeEnv: Env['NODE_ENV']
  readonly processRole: Env['PROCESS_ROLE']
  readonly port: number
  readonly logLevel: Env['LOG_LEVEL']
  readonly databaseUrl: string
  readonly databasePoolMax: number
  readonly redisUrl: string
  readonly s3: {
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    forcePathStyle: boolean
  }
  // Read-only: every consumer receives the validated snapshot's own list.
  readonly corsOrigins: readonly string[]
  readonly trustProxy: string
  readonly outboxPollMs: number
  readonly openapiUiEnabled: boolean

  constructor(env: Env) {
    this.nodeEnv = env.NODE_ENV
    this.processRole = env.PROCESS_ROLE
    this.port = env.PORT
    this.logLevel = env.LOG_LEVEL
    this.databaseUrl = env.DATABASE_URL
    this.databasePoolMax = env.DATABASE_POOL_MAX
    this.redisUrl = env.REDIS_URL
    this.s3 = {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    }
    this.corsOrigins = env.CORS_ORIGINS
    this.trustProxy = env.TRUST_PROXY
    this.outboxPollMs = env.OUTBOX_POLL_MS
    this.openapiUiEnabled = env.OPENAPI_UI_ENABLED
  }
}
