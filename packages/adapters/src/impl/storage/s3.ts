/**
 * S3StorageAdapter — the system-of-record object store (ADR-006), via
 * @aws-sdk/client-s3. Works with any S3-compatible endpoint (AWS S3, MinIO,
 * Cloudflare R2, Wasabi) using a configurable endpoint + path-style toggle.
 * `url()` returns a presigned GET URL. Credentials come from AdapterEnv only —
 * never hardcoded, never logged. Google Drive is a separate low-priority MIRROR
 * (see drive-mirror.ts), NOT primary.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { StorageAdapter } from '../../interfaces/storage.js';
import type { StoredObject } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';

export interface S3AdapterOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  /** Optional public base URL for objects (CDN); if set, put() returns it. */
  publicBaseUrl?: string;
}

/** Convert a web ReadableStream / Node stream / Buffer to a Buffer. */
async function toBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  // AWS SDK v3 Node stream has transformToByteArray on the response body.
  const maybe = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof maybe.transformToByteArray === 'function') {
    return Buffer.from(await maybe.transformToByteArray());
  }
  // Async iterable (Node Readable).
  const asyncIterable = body as AsyncIterable<Uint8Array>;
  if (typeof asyncIterable[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    for await (const chunk of asyncIterable) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  throw new Error('Unsupported S3 body type');
}

export class S3StorageAdapter implements StorageAdapter {
  readonly name = 's3';
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor(opts: S3AdapterOptions) {
    if (!opts.bucket) throw new AdapterError('S3_BUCKET missing', this.name);
    this.bucket = opts.bucket;
    if (opts.publicBaseUrl) this.publicBaseUrl = opts.publicBaseUrl.replace(/\/$/, '');

    const config: S3ClientConfig = {
      region: opts.region ?? 'us-east-1',
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
      forcePathStyle: opts.forcePathStyle ?? true,
    };
    if (opts.endpoint) config.endpoint = opts.endpoint;
    this.client = new S3Client(config);
  }

  async put(
    key: string,
    data: Buffer | Uint8Array,
    contentType?: string,
  ): Promise<StoredObject> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buf,
          ...(contentType ? { ContentType: contentType } : {}),
        }),
      );
    } catch (err) {
      throw new AdapterError(`S3 put failed: ${key}`, this.name, err);
    }
    const out: StoredObject = { key, bytes: buf.byteLength };
    if (this.publicBaseUrl) out.url = `${this.publicBaseUrl}/${key}`;
    return out;
  }

  async get(key: string): Promise<Buffer> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return await toBuffer(res.Body);
    } catch (err) {
      throw new AdapterError(`S3 get failed: ${key}`, this.name, err);
    }
  }

  async url(key: string, expiresInSeconds = 3600): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    } catch (err) {
      throw new AdapterError(`S3 presign failed: ${key}`, this.name, err);
    }
  }
}
