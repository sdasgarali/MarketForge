/**
 * Per-org provider integration settings. Credentials are stored as one
 * envelope-encrypted JSON blob per provider in `api_credentials`
 * (kind=`provider:<id>`, brandId=null). Secrets NEVER leave the server in
 * cleartext — `list()` returns only non-secret field values + a "set" flag.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { GDriveClient } from '@marketforge/adapters';
import { apiCredentials, db, withTenant } from '@marketforge/db';
import {
  type EncryptedSecret,
  decryptSecretString,
  encryptSecret,
} from '@marketforge/secrets';
import { NotFoundError } from '../../http/errors.js';
import {
  CREDENTIAL_KIND_PREFIX,
  INTEGRATIONS,
  type IntegrationProvider,
  getProvider,
} from './registry.js';

const kindFor = (id: string) => `${CREDENTIAL_KIND_PREFIX}${id}`;

interface CipherRow {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  dekWrapped: Buffer;
  kekId: string | null;
}

function toEncrypted(row: CipherRow): EncryptedSecret {
  return {
    ciphertext: row.ciphertext.toString('base64'),
    iv: row.iv.toString('base64'),
    authTag: row.authTag.toString('base64'),
    dekWrapped: row.dekWrapped.toString('base64'),
    kekId: row.kekId ?? '',
    alg: 'AES-256-GCM',
    v: 1,
  };
}

function decodeValues(row: CipherRow): Record<string, string> {
  try {
    return JSON.parse(decryptSecretString(toEncrypted(row))) as Record<string, string>;
  } catch {
    return {};
  }
}

function providerView(
  provider: IntegrationProvider,
  values: Record<string, string> | null,
  updatedAt?: Date | null,
) {
  const configured = values !== null;
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    description: provider.description,
    configured,
    updated_at: updatedAt ? updatedAt.toISOString() : null,
    fields: provider.fields.map((f) => ({
      key: f.key,
      label: f.label,
      secret: f.secret,
      optional: f.optional ?? false,
      multiline: f.multiline ?? false,
      placeholder: f.placeholder ?? null,
      // Non-secret values are echoed back; secrets only report is_set.
      value: !f.secret && values ? (values[f.key] ?? '') : '',
      is_set: values ? Boolean(values[f.key]) : false,
    })),
  };
}

export const integrationsService = {
  /** All providers with configured status + non-secret field values. */
  async list(orgId: string) {
    return withTenant(db, orgId, async (tx) => {
      const rows = await tx
        .select({
          kind: apiCredentials.kind,
          ciphertext: apiCredentials.ciphertext,
          iv: apiCredentials.iv,
          authTag: apiCredentials.authTag,
          dekWrapped: apiCredentials.dekWrapped,
          kekId: apiCredentials.kekId,
          updatedAt: apiCredentials.updatedAt,
        })
        .from(apiCredentials)
        .where(isNull(apiCredentials.brandId));

      const byKind = new Map(rows.map((r) => [r.kind, r]));
      return INTEGRATIONS.map((p) => {
        const row = byKind.get(kindFor(p.id));
        const values = row ? decodeValues(row) : null;
        return providerView(p, values, row?.updatedAt);
      });
    });
  },

  /** Create/replace a provider's credentials (encrypted). */
  async set(orgId: string, providerId: string, values: Record<string, string>) {
    const provider = getProvider(providerId);
    if (!provider) throw new NotFoundError(`Unknown provider: ${providerId}`);

    // Merge with existing so a partial update keeps unspecified secret fields.
    const kind = kindFor(providerId);
    return withTenant(db, orgId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(apiCredentials)
        .where(and(eq(apiCredentials.kind, kind), isNull(apiCredentials.brandId)))
        .limit(1);

      const merged: Record<string, string> = existing
        ? { ...decodeValues(existing as CipherRow) }
        : {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== undefined && v !== '') merged[k] = v;
      }

      const enc = encryptSecret(JSON.stringify(merged));
      const payload = {
        ciphertext: Buffer.from(enc.ciphertext, 'base64'),
        iv: Buffer.from(enc.iv, 'base64'),
        authTag: Buffer.from(enc.authTag, 'base64'),
        dekWrapped: Buffer.from(enc.dekWrapped, 'base64'),
        kekId: enc.kekId,
        updatedAt: new Date(),
      };

      if (existing) {
        await tx.update(apiCredentials).set(payload).where(eq(apiCredentials.id, existing.id));
      } else {
        await tx.insert(apiCredentials).values({
          orgId,
          brandId: null,
          kind,
          label: provider.name,
          ...payload,
        });
      }
      return providerView(provider, merged, payload.updatedAt);
    });
  },

  /** Remove a provider's credentials. */
  async remove(orgId: string, providerId: string) {
    const provider = getProvider(providerId);
    if (!provider) throw new NotFoundError(`Unknown provider: ${providerId}`);
    const kind = kindFor(providerId);
    await withTenant(db, orgId, async (tx) => {
      await tx
        .delete(apiCredentials)
        .where(and(eq(apiCredentials.kind, kind), isNull(apiCredentials.brandId)));
    });
    return { id: providerId };
  },

  /**
   * Live connectivity test for a provider (currently Google Drive): decrypt the
   * stored creds and hit the provider to confirm they actually work.
   */
  async test(orgId: string, providerId: string) {
    const values = await this.resolve(orgId, providerId);
    if (!values) {
      throw new NotFoundError(`${providerId} is not configured`);
    }
    if (providerId === 'google_drive') {
      const client = new GDriveClient({
        clientEmail: values.clientEmail ?? '',
        privateKey: values.privateKey ?? '',
        rootFolderId: values.rootFolderId || undefined,
      });
      const result = await client.test();
      return { ok: true, provider: providerId, detail: result };
    }
    // Other providers: presence check only (no cheap probe available).
    return { ok: true, provider: providerId, detail: { configured: true } };
  },

  /** Decrypt a provider's stored credentials (for the worker/adapters). */
  async resolve(orgId: string, providerId: string): Promise<Record<string, string> | null> {
    const kind = kindFor(providerId);
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .select()
        .from(apiCredentials)
        .where(and(eq(apiCredentials.kind, kind), isNull(apiCredentials.brandId)))
        .limit(1);
      return row ? decodeValues(row as CipherRow) : null;
    });
  },
};
