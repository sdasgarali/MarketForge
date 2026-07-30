/**
 * Key Encryption Key (KEK) provider abstraction.
 *
 * The KEK is the top-level "master" key that wraps (encrypts) per-secret Data
 * Encryption Keys (DEKs) — see `envelope.ts`. Per ADR-009 the MVP loads the KEK
 * from the environment via {@link EnvKeyProvider}, but all envelope operations
 * go through the {@link KeyProvider} interface so a KMS-backed provider can be
 * dropped in later WITHOUT touching the envelope code.
 *
 * To add a KMS later, implement `KeyProvider` (e.g. `KmsKeyProvider`) whose
 * `getKek()` returns the plaintext KEK material fetched/unwrapped from the KMS
 * (or, better, restructure so wrap/unwrap are delegated to the KMS directly).
 */
import { env } from '@marketforge/config';

/** Required AES-256 key length in bytes. */
export const KEK_BYTES = 32;

/**
 * Abstraction over the source of the master key. Implementations must return a
 * stable 32-byte KEK and a stable, human-meaningful `kekId` used for rotation
 * and to reference the key that wrapped a given ciphertext.
 */
export interface KeyProvider {
  /** Identifier stored alongside ciphertext (rotation / KMS key reference). */
  readonly kekId: string;
  /** Returns the raw 32-byte KEK material. Never log or persist this value. */
  getKek(): Buffer;
}

/**
 * Loads and validates the base64-encoded master key from
 * `env.ENCRYPTION_MASTER_KEY`. Fails fast (at construction) if the key does not
 * decode to exactly 32 bytes.
 */
export class EnvKeyProvider implements KeyProvider {
  public readonly kekId: string;
  readonly #kek: Buffer;

  public constructor() {
    this.kekId = env.ENCRYPTION_KEK_ID;
    this.#kek = decodeMasterKey(env.ENCRYPTION_MASTER_KEY);
  }

  public getKek(): Buffer {
    return this.#kek;
  }
}

/**
 * Decodes and validates a base64 master key. Exported for testing / alternative
 * providers. Throws a clear error on wrong length or malformed base64.
 */
export function decodeMasterKey(base64: string): Buffer {
  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64, 'base64');
  } catch {
    throw new Error(
      'ENCRYPTION_MASTER_KEY is not valid base64. Expected a base64-encoded 32-byte AES-256 key.',
    );
  }

  // Buffer.from silently ignores invalid base64 chars, so re-validate length.
  if (decoded.length !== KEK_BYTES) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must decode to exactly ${KEK_BYTES} bytes (AES-256), ` +
        `but decoded to ${decoded.length} bytes. Provide a base64-encoded 32-byte key.`,
    );
  }

  return decoded;
}

/**
 * Default process-wide KEK provider (env-backed). Construction validates the
 * master key immediately. Swap this out for a `KmsKeyProvider` singleton when a
 * KMS is introduced.
 */
export const defaultKeyProvider: KeyProvider = new EnvKeyProvider();
