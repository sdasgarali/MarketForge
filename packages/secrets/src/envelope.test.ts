/**
 * Roundtrip + tamper + API-key tests for @marketforge/secrets.
 *
 * These need ENCRYPTION_MASTER_KEY + API_KEY_HASH_PEPPER present in env. We set
 * them BEFORE importing the module (config validates env at import, and the
 * default KEK provider decodes the master key at construction), so the module
 * is loaded via dynamic import after env is populated. Runnable in isolation:
 *   node --test packages/secrets/src/envelope.test.ts
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

// Populate required env BEFORE importing the module under test.
process.env.APP_ENV ??= 'TEST';
process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/marketforge_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.ENCRYPTION_MASTER_KEY ??= randomBytes(32).toString('base64');
process.env.ENCRYPTION_KEK_ID ??= 'test-kek-v1';
process.env.API_KEY_HASH_PEPPER ??= 'test-pepper-value';

// Dynamic import so the assignments above land first.
const {
  encryptSecret,
  decryptSecret,
  decryptSecretString,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
} = await import('./index.js');

test('envelope: encrypt then decrypt returns original plaintext', () => {
  const plaintext = 'super-secret-anthropic-key-\u{1F510}';
  const enc = encryptSecret(plaintext);

  assert.equal(enc.alg, 'AES-256-GCM');
  assert.equal(enc.v, 1);
  assert.equal(enc.kekId, 'test-kek-v1');
  // Ciphertext must not equal the plaintext (base64-encoded).
  assert.notEqual(Buffer.from(enc.ciphertext, 'base64').toString('utf8'), plaintext);

  assert.equal(decryptSecretString(enc), plaintext);
});

test('envelope: Buffer plaintext roundtrips byte-for-byte', () => {
  const buf = randomBytes(64);
  const enc = encryptSecret(buf);
  assert.ok(decryptSecret(enc).equals(buf));
});

test('envelope: tampering with ciphertext throws', () => {
  const enc = encryptSecret('do-not-tamper');
  const bytes = Buffer.from(enc.ciphertext, 'base64');
  bytes[0] = bytes[0]! ^ 0xff;
  const tampered = { ...enc, ciphertext: bytes.toString('base64') };
  assert.throws(() => decryptSecret(tampered));
});

test('envelope: tampering with authTag throws', () => {
  const enc = encryptSecret('do-not-tamper');
  const tag = Buffer.from(enc.authTag, 'base64');
  tag[0] = tag[0]! ^ 0xff;
  const tampered = { ...enc, authTag: tag.toString('base64') };
  assert.throws(() => decryptSecret(tampered));
});

test('envelope: kekId mismatch throws', () => {
  const enc = encryptSecret('x');
  const tampered = { ...enc, kekId: 'some-other-kek' };
  assert.throws(() => decryptSecret(tampered), /KEK id mismatch/);
});

test('api-key: generate produces mf_ key with prefix', () => {
  const { key, prefix } = generateApiKey();
  assert.match(key, /^mf_[0-9a-f]+$/);
  assert.equal(prefix, key.slice(0, 8));
});

test('api-key: verify true for correct key, false for wrong key', () => {
  const { key } = generateApiKey();
  const stored = hashApiKey(key);

  assert.equal(verifyApiKey(key, stored), true);
  assert.equal(verifyApiKey('mf_wrongkey', stored), false);
  assert.equal(verifyApiKey(key, 'not-hex-!!'), false);
  assert.equal(verifyApiKey(key, ''), false);
});
