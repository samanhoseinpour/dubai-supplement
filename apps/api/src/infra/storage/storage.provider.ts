import { Injectable, type OnApplicationShutdown } from '@nestjs/common'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AppConfig } from '../config/index.js'

/**
 * The port. Modules depend on this class as a token; only storage.module.ts
 * knows an S3 SDK exists, so nothing above `infra/` names a command or a
 * bucket. The same adapter serves RustFS in development and Liara in
 * production — path-style addressing is what makes that one code path.
 */
@Injectable()
export abstract class StorageProvider {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>
  abstract getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  abstract delete(key: string): Promise<void>
  abstract head(key: string): Promise<{ contentLength: number } | null>
  abstract ensureBucket(): Promise<void>
}

@Injectable()
export class S3StorageProvider extends StorageProvider implements OnApplicationShutdown {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: AppConfig) {
    super()
    this.bucket = config.s3.bucket
    // The client is lazy — no network call until a command runs, which is
    // what lets `pnpm --filter api openapi` boot with no services (§5.5).
    // Credentials are passed explicitly so the SDK never falls through to
    // its provider chain, which would reach for AWS's instance metadata
    // service on a host that has none.
    this.client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      forcePathStyle: config.s3.forcePathStyle,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    })
  }

  /**
   * The bucket, after this returns — created if it was not there, and ours.
   *
   * Idempotent on the success path, not only on the error path: RustFS
   * answers 200 to CreateBucket for a bucket that already exists (measured
   * in Task 3), so against it nothing is ever thrown and neither branch
   * below runs at all. Real S3 and Liara answer 409, and *which* 409
   * decides everything, because S3 bucket names are global:
   *
   * - `BucketAlreadyOwnedByYou` — it is ours. CreateBucket is idempotent for
   *   the owner, so there is nothing left to do.
   * - `BucketAlreadyExists` — the name is taken by **another account**, so
   *   nothing here can read or write it. This is what a mistyped or
   *   already-claimed S3_BUCKET looks like. Swallowing it does not hide the
   *   problem — docs/runbooks/first-deploy.md §6 `put`s straight after this
   *   and would fail there anyway — it hides the *cause*, behind a bare
   *   `AccessDenied` that reads like bad credentials and sends the operator
   *   to the wrong place. Failing here names the bucket instead.
   */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
    } catch (error) {
      const name = (error as { name?: string }).name
      if (name === 'BucketAlreadyOwnedByYou') return
      if (name === 'BucketAlreadyExists') {
        throw new Error(
          `S3 bucket "${this.bucket}" already exists and is owned by another account, so ` +
            'nothing here can write to it. S3 bucket names are global — set S3_BUCKET to a ' +
            'name this account owns.',
          { cause: error },
        )
      }
      throw error
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    )
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    })
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  /** `null` for a missing object; every other failure is still an error. */
  async head(key: string): Promise<{ contentLength: number } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return { contentLength: res.ContentLength ?? 0 }
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return null
      throw error
    }
  }

  /**
   * The sockets the SDK's keep-alive agent holds, released — the counterpart
   * of RedisModule's RedisCloser and DbModule's PoolCloser. Nothing is open
   * until the first command, so on a process that never stored anything this
   * costs nothing; after one that did, it is what lets the event loop drain
   * on SIGTERM. Nest runs this whatever token the provider is registered
   * under, and app.close() runs it with or without enableShutdownHooks.
   */
  onApplicationShutdown(): void {
    this.client.destroy()
  }
}
