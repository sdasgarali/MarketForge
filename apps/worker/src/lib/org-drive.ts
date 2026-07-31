/**
 * Resolve an org's Google Drive client from its saved service-account
 * credentials (integrations → api_credentials, kind='provider:google_drive').
 * Returns null when Drive isn't configured. Used by the drive-mirror processor
 * to actually upload generated assets into <Brand>/videos/<topic>/.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { GDriveClient } from '@marketforge/adapters';
import { apiCredentials, db, withTenant } from '@marketforge/db';
import { type EncryptedSecret, decryptSecretString } from '@marketforge/secrets';

const KIND = 'provider:google_drive';

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

export async function getOrgDrive(orgId: string): Promise<GDriveClient | null> {
  try {
    const [row] = await withTenant(db, orgId, (tx) =>
      tx
        .select()
        .from(apiCredentials)
        .where(and(eq(apiCredentials.kind, KIND), isNull(apiCredentials.brandId)))
        .limit(1),
    );
    if (!row) return null;
    const vals = JSON.parse(decryptSecretString(toEncrypted(row as CipherRow))) as Record<
      string,
      string
    >;
    if (!vals.clientEmail || !vals.privateKey) return null;
    return new GDriveClient({
      clientEmail: vals.clientEmail,
      privateKey: vals.privateKey,
      rootFolderId: vals.rootFolderId || undefined,
    });
  } catch {
    return null;
  }
}
