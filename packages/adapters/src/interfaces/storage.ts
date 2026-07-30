import type { StoredObject } from './types.js';

export interface StorageAdapter {
  readonly name: string;
  put(key: string, data: Buffer | Uint8Array, contentType?: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  url(key: string, expiresInSeconds?: number): Promise<string>;
}
