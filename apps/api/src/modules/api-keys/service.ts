/**
 * Admin API-keys service. Generates an inbound SaaS API key, returns the raw key
 * to the caller ONCE, and stores only its HMAC hash (ADR-009). Reuses the
 * `api_credentials` table: kind='api_key', label=prefix, ciphertext=hash bytes.
 * The hash is not a secret plaintext, so we store the hash bytes directly (no
 * envelope needed) but keep the row shape valid with zero-length iv/authTag/dek.
 */
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { apiCredentials, db, withTenant } from '@marketforge/db';
import { generateApiKey, hashApiKey } from '@marketforge/secrets';
import { NotFoundError } from '../../http/errors.js';

export const ApiKeyCreateInput = z.object({
  label: z.string().min(1).max(100),
  expires_at: z.string().datetime({ offset: true }).optional(),
});
export type ApiKeyCreateInput = z.infer<typeof ApiKeyCreateInput>;

const EMPTY = Buffer.alloc(0);

export const apiKeysService = {
  /** Create a key; the raw `key` is returned once and never stored. */
  async create(orgId: string, input: ApiKeyCreateInput) {
    const { key, prefix } = generateApiKey();
    const hash = hashApiKey(key);

    const row = await withTenant(db, orgId, async (tx) => {
      const [r] = await tx
        .insert(apiCredentials)
        .values({
          orgId,
          kind: 'api_key',
          label: `${input.label} (${prefix})`,
          ciphertext: Buffer.from(hash, 'hex'),
          iv: EMPTY,
          authTag: EMPTY,
          dekWrapped: EMPTY,
          kekId: 'api-key-hash',
          expiresAt: input.expires_at ? new Date(input.expires_at) : null,
        })
        .returning({ id: apiCredentials.id, createdAt: apiCredentials.createdAt });
      return r!;
    });

    return {
      id: row.id,
      // Shown ONCE — client must store it now.
      key,
      prefix,
      created_at: row.createdAt?.toISOString(),
    };
  },

  async list(orgId: string) {
    return withTenant(db, orgId, async (tx) => {
      const rows = await tx
        .select({
          id: apiCredentials.id,
          label: apiCredentials.label,
          createdAt: apiCredentials.createdAt,
          expiresAt: apiCredentials.expiresAt,
        })
        .from(apiCredentials)
        .where(eq(apiCredentials.kind, 'api_key'))
        .orderBy(desc(apiCredentials.createdAt));
      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        created_at: r.createdAt?.toISOString(),
        expires_at: r.expiresAt?.toISOString(),
      }));
    });
  },

  async revoke(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .delete(apiCredentials)
        .where(eq(apiCredentials.id, id))
        .returning({ id: apiCredentials.id });
      if (!row) throw new NotFoundError(`API key ${id} not found`);
      return { id: row.id };
    });
  },
};
