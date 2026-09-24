import { Global, Module } from '@nestjs/common'
import { S3StorageProvider, StorageProvider } from './storage.provider.js'

/**
 * The object-storage port over S3.
 *
 * @Global() decides who may inject StorageProvider, not whether the module is
 * built: one import into the root graph is still what instantiates it.
 * Nothing connects here — the S3 client is lazy (§5.5).
 */
@Global()
@Module({
  providers: [{ provide: StorageProvider, useClass: S3StorageProvider }],
  exports: [StorageProvider],
})
export class StorageModule {}
