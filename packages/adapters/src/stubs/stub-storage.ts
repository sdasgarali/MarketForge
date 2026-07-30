// STUB — replace with real impl in src/impl/<name>.ts (owned by another agent).
//
// Real backend: S3 primary + Google Drive mirror (ADR-006). No MCP — AWS SDK
// (S3_* env) + Google Drive API (GOOGLE_DRIVE_* env).
//
// This stub is a fully-working in-memory store (Map) so downstream dev/tests
// can put/get/url without any cloud credentials. get() on a missing key throws
// AdapterError to mirror real not-found behavior.

import type { StorageAdapter } from '../interfaces/storage.js';
import type { StoredObject } from '../interfaces/types.js';
import { AdapterError } from '../errors.js';

export class StubStorageAdapter implements StorageAdapter {
  readonly name = 'stub-storage';

  private readonly store = new Map<string, Buffer>();

  async put(key: string, data: Buffer | Uint8Array, _contentType?: string): Promise<StoredObject> {
    // TODO(impl): upload to S3, mirror to Google Drive; return signed url + bytes.
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    this.store.set(key, buf);
    return { key, url: `stub://${key}`, bytes: buf.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    // TODO(impl): fetch from S3 (fall back to Drive mirror).
    const buf = this.store.get(key);
    if (!buf) {
      throw new AdapterError(`Object not found: ${key}`, this.name);
    }
    return buf;
  }

  async url(key: string, _expiresInSeconds?: number): Promise<string> {
    // TODO(impl): return a presigned S3 URL with expiry.
    return `stub://${key}`;
  }
}
