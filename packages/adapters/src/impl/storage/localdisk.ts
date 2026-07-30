/**
 * LocalDiskStorageAdapter — the dev default when S3 is not configured. Writes
 * objects under `env.DATA_DIR` (OS-resolved), preserving key "paths" as nested
 * directories. Keys are sanitised to stay inside the root (no path traversal).
 * `url()` returns a `file://` URL (dev only). Fully offline — no network — so it
 * doubles as the storage used in unit tests (roundtrip). Cross-platform: uses
 * `node:path` so it works on Windows and Linux.
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { StorageAdapter } from '../../interfaces/storage.js';
import type { StoredObject } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';

export interface LocalDiskAdapterOptions {
  /** Root directory (typically env.DATA_DIR). */
  rootDir: string;
  /** Sub-namespace under root (default 'objects'). */
  namespace?: string;
}

export class LocalDiskStorageAdapter implements StorageAdapter {
  readonly name = 'local-disk';
  private readonly baseDir: string;

  constructor(opts: LocalDiskAdapterOptions) {
    if (!opts.rootDir) throw new AdapterError('rootDir (DATA_DIR) missing', this.name);
    this.baseDir = path.resolve(opts.rootDir, opts.namespace ?? 'objects');
  }

  /** Resolve a key to an absolute path, guarding against traversal. */
  private resolveKey(key: string): string {
    const cleaned = key.replace(/^[/\\]+/, '');
    const full = path.resolve(this.baseDir, cleaned);
    const rel = path.relative(this.baseDir, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new AdapterError(`Illegal storage key (path traversal): ${key}`, this.name);
    }
    return full;
  }

  async put(
    key: string,
    data: Buffer | Uint8Array,
    _contentType?: string,
  ): Promise<StoredObject> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const full = this.resolveKey(key);
    try {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buf);
    } catch (err) {
      throw new AdapterError(`LocalDisk put failed: ${key}`, this.name, err);
    }
    return { key, url: pathToFileURL(full).href, bytes: buf.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    const full = this.resolveKey(key);
    try {
      return await fs.readFile(full);
    } catch (err) {
      throw new AdapterError(`Object not found: ${key}`, this.name, err);
    }
  }

  async url(key: string, _expiresInSeconds?: number): Promise<string> {
    // No presigning on local disk; return a file:// URL (dev only).
    return pathToFileURL(this.resolveKey(key)).href;
  }
}
