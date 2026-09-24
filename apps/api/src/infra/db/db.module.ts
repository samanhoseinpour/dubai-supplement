import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common'
import type pg from 'pg'
import { AppConfig } from '../config/index.js'
import { createDb, createPool, DRIZZLE, PG_POOL } from './drizzle.provider.js'

// The last hook Nest runs on close, so every module's own destroy hook has
// finished with the database before the pool ends.
@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => createPool(config),
    },
    { provide: DRIZZLE, inject: [PG_POOL], useFactory: (pool: pg.Pool) => createDb(pool) },
    PoolCloser,
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DbModule {}
