/**
 * @marketforge/secrets — envelope encryption (AES-256-GCM) and API-key hashing.
 *
 * See ADR-009. The KEK is loaded from env for the MVP but abstracted behind
 * {@link KeyProvider} so a KMS can slot in later.
 */
export {
  encryptSecret,
  decryptSecret,
  decryptSecretString,
  wrapDek,
  unwrapDek,
  type EncryptedSecret,
} from './envelope.js';

export {
  EnvKeyProvider,
  defaultKeyProvider,
  decodeMasterKey,
  KEK_BYTES,
  type KeyProvider,
} from './kek.js';

export { generateApiKey, hashApiKey, verifyApiKey } from './hash.js';
