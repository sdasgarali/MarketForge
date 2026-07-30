import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalDiskStorageAdapter } from './localdisk.js';
import { AdapterError } from '../../errors.js';

let tmpRoot: string;
let store: LocalDiskStorageAdapter;

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mf-localdisk-'));
  store = new LocalDiskStorageAdapter({ rootDir: tmpRoot });
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('LocalDiskStorageAdapter roundtrip (no network)', () => {
  it('put then get returns identical bytes', async () => {
    const data = Buffer.from('hello marketforge', 'utf8');
    const stored = await store.put('brand/1/post.txt', data, 'text/plain');
    expect(stored.key).toBe('brand/1/post.txt');
    expect(stored.bytes).toBe(data.byteLength);
    expect(stored.url).toMatch(/^file:\/\//);

    const got = await store.get('brand/1/post.txt');
    expect(got.equals(data)).toBe(true);
  });

  it('handles binary (Uint8Array) input', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 255]);
    await store.put('bin/data.bin', bytes);
    const got = await store.get('bin/data.bin');
    expect([...got]).toEqual([0, 1, 2, 3, 255]);
  });

  it('url returns a file:// URL', async () => {
    const url = await store.url('brand/1/post.txt');
    expect(url).toMatch(/^file:\/\//);
  });

  it('get on missing key throws AdapterError', async () => {
    await expect(store.get('does/not/exist')).rejects.toBeInstanceOf(AdapterError);
  });

  it('rejects path-traversal keys', async () => {
    await expect(store.put('../escape.txt', Buffer.from('x'))).rejects.toBeInstanceOf(
      AdapterError,
    );
  });

  it('creates nested directories from the key path', async () => {
    await store.put('a/b/c/d/deep.txt', Buffer.from('deep'));
    const got = await store.get('a/b/c/d/deep.txt');
    expect(got.toString()).toBe('deep');
  });
});
