import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing via Node's built-in scrypt (no native/3rd-party dep, works
 * in the Alpine runtime image). Format: `scrypt$<saltHex>$<hashHex>`.
 */
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
