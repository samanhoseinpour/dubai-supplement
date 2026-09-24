import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
// The config barrel evaluates `ConfigModule`, whose `forRoot({ envFilePath:
// '.env', validate })` runs at decoration time, so this file needs a
// schema-valid environment at import — vitest.config.ts supplies one.
import { AppConfig, EnvSchema } from '../config/index.js'
import { S3StorageProvider } from './storage.provider.js'

/**
 * `ensureBucket` against the two 409s, with no container and no Docker.
 *
 * This cannot be an integration test. RustFS answers 200 to every
 * CreateBucket (measured in Task 3) and has no notion of another account, so
 * the container can never produce `BucketAlreadyExists` — the one case that
 * matters most, because it is the one that must *not* be treated as success.
 *
 * A stub of the SDK would only prove that the method branches on a string it
 * was handed. What has to hold is that S3's actual wire error arrives as that
 * string, so this drives the real client against a real socket and lets the
 * SDK parse a real S3 error document. That also means the day an SDK bump
 * renames these codes, this file says so rather than the first deploy.
 */
const BUCKET = 'ds-media-prod'

/** The error document S3 returns for a CreateBucket 409, as S3 shapes it. */
const errorXml = (code: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Error><Code>${code}</Code><Message>${code}</Message>` +
  `<BucketName>${BUCKET}</BucketName><RequestId>0</RequestId><HostId>0</HostId></Error>`

let server: Server | undefined

/**
 * An S3 endpoint that answers every request the same way, and the provider
 * pointed at it. Port 0, on loopback: the unit suite must stay runnable with
 * no daemon and nothing already listening.
 */
async function providerAnswering(status: number, body: string): Promise<S3StorageProvider> {
  server = createServer((req, res) => {
    // Drained first: an unread body can reach the client as ECONNRESET
    // instead of the status this test is about.
    req.resume()
    req.on('end', () => {
      res.writeHead(status, { 'content-type': 'application/xml' })
      res.end(body)
    })
  })
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return new S3StorageProvider(
    new AppConfig(
      EnvSchema.parse({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://u:p@127.0.0.1:1/d',
        REDIS_URL: 'redis://127.0.0.1:1/0',
        S3_ENDPOINT: `http://127.0.0.1:${String(port)}`,
        S3_BUCKET: BUCKET,
        S3_ACCESS_KEY_ID: 'k',
        S3_SECRET_ACCESS_KEY: 's',
      }),
    ),
  )
}

describe('S3StorageProvider.ensureBucket', () => {
  afterEach(async () => {
    const running = server
    server = undefined
    if (running === undefined) return
    await new Promise<void>((resolve) => {
      running.close(() => {
        resolve()
      })
    })
  })

  it('creates the bucket when the name is free', async () => {
    const storage = await providerAnswering(200, '')
    await expect(storage.ensureBucket()).resolves.toBeUndefined()
  })

  // Ours already. CreateBucket is idempotent for the owner, and this is the
  // 409 the compose and Liara stacks produce on a second deploy.
  it('accepts BucketAlreadyOwnedByYou, because the bucket is already ours', async () => {
    const storage = await providerAnswering(409, errorXml('BucketAlreadyOwnedByYou'))
    await expect(storage.ensureBucket()).resolves.toBeUndefined()
  })

  /**
   * The one that must not pass. Bucket names are global, so this 409 says
   * another account holds the name: reporting success would let a mistyped
   * production S3_BUCKET clear first-deploy.md §6 and then 403 on the first
   * real upload, after the step meant to catch it had already said OK.
   */
  it('refuses BucketAlreadyExists and names the bucket it cannot have', async () => {
    const storage = await providerAnswering(409, errorXml('BucketAlreadyExists'))
    await expect(storage.ensureBucket()).rejects.toThrow(
      new RegExp(`"${BUCKET}" already exists and is owned by another account`, 'u'),
    )
  })

  // Keeping the SDK's own error as `cause` is what leaves the request id and
  // the status recoverable from a log line.
  it('keeps the S3 error as the cause', async () => {
    const storage = await providerAnswering(409, errorXml('BucketAlreadyExists'))
    await expect(storage.ensureBucket()).rejects.toMatchObject({
      cause: { name: 'BucketAlreadyExists' },
    })
  })

  // Anything else is not this method's business: a wrong key or a revoked
  // permission must reach the caller as itself, not as a bucket-name story.
  it('rethrows any other S3 error untouched', async () => {
    const storage = await providerAnswering(403, errorXml('AccessDenied'))
    await expect(storage.ensureBucket()).rejects.toMatchObject({ name: 'AccessDenied' })
  })
})
