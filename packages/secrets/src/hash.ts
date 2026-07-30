/**
 * API-key generation, hashing, and verification for inbound SaaS API keys.
 *
 * Keys are HMAC-SHA256'd with a secret pepper (`env.API_KEY_HASH_PEPPER`) so
 * only the hash is ever stored. Hashing is deterministic so a lookup by hash
 * works; the pepper adds a secret that isn't in the database. Comparison uses
 * `crypto.timingSafeEqual` to resist timing attacks.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '@marketforge/config';

/** Human-readable prefix on every generated key (for lookup / display). */
const KEY_PREFIX = 'mf_';
/** Number of random bytes in the key body (hex-encoded → 2x chars). */
const KEY_RANDOM_BYTES = 24;
/** Number of leading characters used as the lookup/display prefix. */
const LOOKUP_PREFIX_LEN = 8;

/**
 * Generates a new random API key. The full `key` is shown to the caller ONCE;
 * store only `hashApiKey(key)`. `prefix` is the first ~8 chars for indexed
 * lookup and safe display (e.g. `mf_a1b2`).
 */
export function generateApiKey(): { key: string; prefix: string } {
  const body = randomBytes(KEY_RANDOM_BYTES).toString('hex');
  const key = `${KEY_PREFIX}${body}`;
  const prefix = key.slice(0, LOOKUP_PREFIX_LEN);
  return { key, prefix };
}

/**
 * Deterministically hashes an API key: HMAC-SHA256 keyed by the secret pepper.
 * Returns lowercase hex. Store this value, never the raw key.
 */
export function hashApiKey(key: string): string {
  return createHmac('sha256', env.API_KEY_HASH_PEPPER).update(key, 'utf8').digest('hex');
}

/**
 * Verifies a presented `key` against a previously stored hash in constant time.
 * Returns false (rather than throwing) on any length/format mismatch.
 */
export function verifyApiKey(key: string, storedHash: string): boolean {
  const computed = Buffer.from(hashApiKey(key), 'hex');

  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, 'hex');
  } catch {
    return false;
  }

  if (stored.length !== computed.length || stored.length === 0) {
    return false;
  }
  return timingSafeEqual(computed, stored);
}
