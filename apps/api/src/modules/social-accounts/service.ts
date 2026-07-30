/**
 * Social-accounts service. A social account belongs to a brand and stores the
 * platform + Ayrshare per-brand profile key (ADR-003). Any provided secret/token
 * is envelope-encrypted (ADR-009) into `api_credentials` and only referenced by
 * `credentials_ref` — the raw token is never persisted or returned.
 */
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { Platform } from '@marketforge/contracts';
import { apiCredentials, brands, db, socialAccounts, withTenant } from '@marketforge/db';
import { encryptSecret } from '@marketforge/secrets';
import { NotFoundError } from '../../http/errors.js';
import { socialAccountToDto } from '../../lib/mappers.js';

/** Create/update input for a social account. `secret` is write-only. */
export const SocialAccountInput = z.object({
  platform: Platform,
  handle: z.string().optional(),
  external_account_id: z.string().optional(),
  profile_key: z.string().optional(),
  /** Optional access token / API secret — encrypted at rest, never returned. */
  secret: z.string().optional(),
});
export type SocialAccountInput = z.infer<typeof SocialAccountInput>;

async function assertBrand(tx: Parameters<Parameters<typeof withTenant>[2]>[0], brandId: string) {
  const [brand] = await tx.select({ id: brands.id }).from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) throw new NotFoundError(`Brand ${brandId} not found`);
}

export const socialAccountsService = {
  async list(orgId: string, brandId: string) {
    return withTenant(db, orgId, async (tx) => {
      await assertBrand(tx, brandId);
      const rows = await tx
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.brandId, brandId))
        .orderBy(desc(socialAccounts.createdAt));
      return rows.map(socialAccountToDto);
    });
  },

  async create(orgId: string, brandId: string, input: SocialAccountInput) {
    return withTenant(db, orgId, async (tx) => {
      await assertBrand(tx, brandId);

      let credentialsRef: string | null = null;
      if (input.secret) {
        const enc = encryptSecret(input.secret);
        const [cred] = await tx
          .insert(apiCredentials)
          .values({
            orgId,
            brandId,
            kind: `social:${input.platform}`,
            label: input.handle ?? input.platform,
            ciphertext: Buffer.from(enc.ciphertext, 'base64'),
            iv: Buffer.from(enc.iv, 'base64'),
            authTag: Buffer.from(enc.authTag, 'base64'),
            dekWrapped: Buffer.from(enc.dekWrapped, 'base64'),
            kekId: enc.kekId,
          })
          .returning({ id: apiCredentials.id });
        credentialsRef = cred!.id;
      }

      const [row] = await tx
        .insert(socialAccounts)
        .values({
          orgId,
          brandId,
          platform: input.platform,
          handle: input.handle ?? null,
          externalAccountId: input.external_account_id ?? null,
          profileKey: input.profile_key ?? null,
          credentialsRef,
          connectionStatus: input.secret || input.profile_key ? 'connected' : 'disconnected',
          connectedAt: input.secret || input.profile_key ? new Date() : null,
        })
        .returning();
      return socialAccountToDto(row!);
    });
  },

  async remove(orgId: string, brandId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .delete(socialAccounts)
        .where(and(eq(socialAccounts.id, id), eq(socialAccounts.brandId, brandId)))
        .returning({ id: socialAccounts.id, credentialsRef: socialAccounts.credentialsRef });
      if (!row) throw new NotFoundError(`Social account ${id} not found`);
      if (row.credentialsRef) {
        await tx.delete(apiCredentials).where(eq(apiCredentials.id, row.credentialsRef));
      }
      return { id: row.id };
    });
  },
};
