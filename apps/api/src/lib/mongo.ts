import { env } from '@marketforge/config';
import { type Collection, MongoClient } from 'mongodb';

/**
 * MongoDB user/credential store (the manual-JWT auth backend). Kept separate
 * from Postgres, which remains the tenant/data system of record. A single
 * lazily-connected client is reused across requests.
 */
export interface UserDoc {
  email: string;
  passwordHash: string;
  name?: string;
  /** MarketForge (Postgres) org this user is scoped to for RLS. */
  orgId: string;
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  createdAt: Date;
  lastLoginAt?: Date;
}

let clientPromise: Promise<MongoClient> | undefined;

function client(): Promise<MongoClient> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured (required for JWT auth)');
  }
  // Cache the connection, but DON'T cache a rejected promise — otherwise the
  // first failed connect (e.g. before the IP was allowlisted) would be reused
  // forever. Reset on failure so the next request retries.
  if (!clientPromise) {
    clientPromise = new MongoClient(env.MONGODB_URI).connect().catch((err) => {
      clientPromise = undefined;
      throw err;
    });
  }
  return clientPromise;
}

/** Users collection, with a unique index on email (created once, idempotent). */
export async function usersCollection(): Promise<Collection<UserDoc>> {
  const c = await client();
  const col = c.db(env.MONGODB_DB).collection<UserDoc>('users');
  await col.createIndex({ email: 1 }, { unique: true });
  return col;
}
