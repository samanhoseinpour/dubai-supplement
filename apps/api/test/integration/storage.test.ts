import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { AppConfig, ConfigModule } from '../../src/infra/config/index.js'
import { StorageModule, StorageProvider } from '../../src/infra/storage/index.js'

/**
 * Two ways in. Under vitest.integration.config.ts this runs against the
 * Testcontainers RustFS, which has no init sidecar — the bucket does not
 * exist until ensureBucket() makes it. Under vitest.storage.config.ts
 * (`pnpm --filter api test:storage`) the same file runs against whatever
 * S3_* the operator exported, which is how first-deploy.md smoke-tests
 * Liara once. Nothing here may assume a bucket name or a container.
 */
describe('StorageProvider against RustFS', () => {
  let storage: StorageProvider
  let bucket: string
  let close: () => Promise<void>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, StorageModule],
    }).compile()
    const app = await moduleRef.init()
    storage = app.get(StorageProvider)
    bucket = app.get(AppConfig).s3.bucket
    close = () => app.close()
    await storage.ensureBucket()
  })

  afterAll(async () => {
    await close()
  })

  /**
   * RustFS answers 200, not 409, when CreateBucket names a bucket that
   * already exists (measured in Task 3), so against it the
   * BucketAlreadyOwnedByYou catch never fires and cannot be what makes this
   * idempotent. Real S3 and Liara do return 409, which is why the catch
   * stays. Both paths have to end in "the bucket is there".
   */
  it('creates the bucket, and says so again without failing', async () => {
    await expect(storage.ensureBucket()).resolves.toBeUndefined()
    await expect(storage.ensureBucket()).resolves.toBeUndefined()
  })

  it('puts, heads, signs and deletes — the same path Liara will take', async () => {
    const key = `smoke/${String(Date.now())}.txt`
    await storage.put(key, Buffer.from('hello'), 'text/plain')

    const head = await storage.head(key)
    expect(head?.contentLength).toBe(5)

    const url = await storage.getSignedUrl(key, 60)
    expect(url).toContain(key)
    // forcePathStyle: the bucket must be in the path, not the hostname —
    // Liara's endpoint does not do virtual-host addressing. Read from the
    // config rather than written down, because first-deploy.md points this
    // same test at a production bucket whose name is not `dubaisupp`; a
    // virtual-host URL puts the bucket in the host and fails this either way.
    expect(url).toContain(`/${bucket}/`)

    await storage.delete(key)
    expect(await storage.head(key)).toBeNull()
  })
})
