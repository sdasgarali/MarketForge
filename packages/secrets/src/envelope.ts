/**
 * Envelope encryption (AES-256-GCM) per ADR-009.
 *
 * Scheme:
 *   1. Generate a fresh random 32-byte DEK (Data Encryption Key) per secret.
 *   2. Encrypt the plaintext with AES-256-GCM under the DEK (random 12-byte IV,
 *      producing a 16-byte auth tag).
 *   3. WRAP the DEK: encrypt the DEK bytes with AES-256-GCM under the KEK
 *      (separate random 12-byte IV + auth tag).
 *   4. Persist: ciphertext, iv, authTag, the wrapped DEK bundle, and the kekId.
 *
 * Decryption reverses: unwrap the DEK with the KEK, then decrypt the ciphertext
 * with the DEK. All binary fields are base64-encoded for easy JSON persistence.
 *
 * The KEK never leaves the process (see `kek.ts`). Only the DEK is ever wrapped,
 * so a future KMS can take over wrap/unwrap without changing the payload shape.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { defaultKeyProvider, KEK_BYTES, type KeyProvider } from './kek.js';

/** AES-GCM standard IV length in bytes. */
const IV_BYTES = 12;
/** AES-GCM auth tag length in bytes. */
const AUTH_TAG_BYTES = 16;
/** DEK length in bytes (AES-256). */
const DEK_BYTES = 32;
/** Cipher identifier used for all operations. */
const ALG = 'aes-256-gcm' as const;

/**
 * Persisted encrypted secret. All binary fields are base64 strings.
 *
 * `dekWrapped` bundles the wrapped-DEK's own iv + authTag + ciphertext (see
 * {@link WrappedDek}) serialized as base64 JSON, so the whole thing is a single
 * opaque string alongside the payload fields.
 */
export interface EncryptedSecret {
  /** Base64 AES-256-GCM ciphertext of the plaintext (encrypted under the DEK). */
  ciphertext: string;
  /** Base64 12-byte IV used to encrypt the plaintext. */
  iv: string;
  /** Base64 16-byte GCM auth tag for the plaintext ciphertext. */
  authTag: string;
  /** Base64-encoded JSON {@link WrappedDek} (DEK encrypted under the KEK). */
  dekWrapped: string;
  /** Id of the KEK that wrapped the DEK (for rotation / KMS reference). */
  kekId: string;
  /** Algorithm marker (fixed for v1). */
  alg: 'AES-256-GCM';
  /** Payload schema version. */
  v: 1;
}

/**
 * The wrapped DEK bundle. Serialized to base64 JSON inside
 * {@link EncryptedSecret.dekWrapped}. All fields base64.
 */
interface WrappedDek {
  /** Base64 IV used to wrap the DEK under the KEK. */
  iv: string;
  /** Base64 GCM auth tag for the wrapped DEK. */
  authTag: string;
  /** Base64 ciphertext of the DEK (encrypted under the KEK). */
  ciphertext: string;
}

/** Internal AES-256-GCM encrypt. Returns raw buffers. */
function gcmEncrypt(
  key: Buffer,
  plaintext: Buffer,
): { iv: Buffer; authTag: Buffer; ciphertext: Buffer } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv, authTag, ciphertext };
}

/** Internal AES-256-GCM decrypt. Throws on auth failure (tampering). */
function gcmDecrypt(
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  ciphertext: Buffer,
): Buffer {
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Wraps (encrypts) a DEK under the provider's KEK. Returns the base64-JSON
 * bundle string suitable for {@link EncryptedSecret.dekWrapped}.
 */
export function wrapDek(dek: Buffer, provider: KeyProvider = defaultKeyProvider): string {
  const kek = provider.getKek();
  if (kek.length !== KEK_BYTES) {
    throw new Error(`KEK must be ${KEK_BYTES} bytes, got ${kek.length}.`);
  }
  const { iv, authTag, ciphertext } = gcmEncrypt(kek, dek);
  const bundle: WrappedDek = {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return Buffer.from(JSON.stringify(bundle), 'utf8').toString('base64');
}

/**
 * Unwraps (decrypts) a DEK previously produced by {@link wrapDek}. Throws on
 * malformed input or GCM auth failure.
 */
export function unwrapDek(
  dekWrapped: string,
  provider: KeyProvider = defaultKeyProvider,
): Buffer {
  const kek = provider.getKek();
  if (kek.length !== KEK_BYTES) {
    throw new Error(`KEK must be ${KEK_BYTES} bytes, got ${kek.length}.`);
  }

  let bundle: WrappedDek;
  try {
    bundle = JSON.parse(
      Buffer.from(dekWrapped, 'base64').toString('utf8'),
    ) as WrappedDek;
  } catch {
    throw new Error('Malformed wrapped DEK: could not decode base64/JSON bundle.');
  }
  if (!bundle.iv || !bundle.authTag || !bundle.ciphertext) {
    throw new Error('Malformed wrapped DEK: missing iv/authTag/ciphertext.');
  }

  const dek = gcmDecrypt(
    kek,
    Buffer.from(bundle.iv, 'base64'),
    Buffer.from(bundle.authTag, 'base64'),
    Buffer.from(bundle.ciphertext, 'base64'),
  );
  if (dek.length !== DEK_BYTES) {
    throw new Error(
      `Unwrapped DEK has unexpected length ${dek.length} (expected ${DEK_BYTES}).`,
    );
  }
  return dek;
}

/**
 * Encrypts a secret using envelope encryption. Generates a fresh DEK, encrypts
 * the plaintext under it, then wraps the DEK under the provider's KEK.
 */
export function encryptSecret(
  plaintext: string | Buffer,
  provider: KeyProvider = defaultKeyProvider,
): EncryptedSecret {
  const plainBuf = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;

  const dek = randomBytes(DEK_BYTES);
  try {
    const { iv, authTag, ciphertext } = gcmEncrypt(dek, plainBuf);
    const dekWrapped = wrapDek(dek, provider);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      dekWrapped,
      kekId: provider.kekId,
      alg: 'AES-256-GCM',
      v: 1,
    };
  } finally {
    // Best-effort: zero the DEK material from memory once wrapped.
    dek.fill(0);
  }
}

/**
 * Decrypts an {@link EncryptedSecret} back to the original plaintext bytes.
 * Validates the kekId matches the provider and that the payload is v1 GCM.
 * Throws on kekId mismatch, malformed payload, or GCM auth failure (tampering).
 */
export function decryptSecret(
  secret: EncryptedSecret,
  provider: KeyProvider = defaultKeyProvider,
): Buffer {
  if (secret.v !== 1 || secret.alg !== 'AES-256-GCM') {
    throw new Error(
      `Unsupported secret payload (v=${String(secret.v)}, alg=${String(secret.alg)}).`,
    );
  }
  if (secret.kekId !== provider.kekId) {
    throw new Error(
      `KEK id mismatch: secret was wrapped with '${secret.kekId}' but provider is '${provider.kekId}'.`,
    );
  }

  const dek = unwrapDek(secret.dekWrapped, provider);
  try {
    const authTag = Buffer.from(secret.authTag, 'base64');
    if (authTag.length !== AUTH_TAG_BYTES) {
      throw new Error('Malformed secret: auth tag has unexpected length.');
    }
    return gcmDecrypt(
      dek,
      Buffer.from(secret.iv, 'base64'),
      authTag,
      Buffer.from(secret.ciphertext, 'base64'),
    );
  } finally {
    dek.fill(0);
  }
}

/**
 * Convenience wrapper around {@link decryptSecret} that returns a UTF-8 string.
 * Use only for secrets known to be UTF-8 text.
 */
export function decryptSecretString(
  secret: EncryptedSecret,
  provider: KeyProvider = defaultKeyProvider,
): string {
  return decryptSecret(secret, provider).toString('utf8');
}
