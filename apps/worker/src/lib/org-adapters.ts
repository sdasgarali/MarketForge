/**
 * Per-org adapter resolution. Reads an org's saved provider credentials
 * (api_credentials, kind=`provider:<id>`), decrypts them, and builds an adapter
 * bundle whose keys come from the ORG (overlaid on the deployment env). The base
 * processor runs each job inside `runWithAdapters(getOrgAdapters(org_id))`, so
 * every `adapters.*` call in agents/processors uses the org's own keys.
 *
 * Cached per org (short TTL) so we don't decrypt on every job.
 */
import { like } from 'drizzle-orm';
import {
  type AdapterEnv,
  type Adapters,
  adapters as defaultAdapters,
  createAdapters,
} from '@marketforge/adapters';
import { env } from '@marketforge/config';
import { apiCredentials, db, withTenant } from '@marketforge/db';
import { type EncryptedSecret, decryptSecretString } from '@marketforge/secrets';

const PREFIX = 'provider:';
const TTL_MS = 60_000;

type Vals = Record<string, string>;

/** Map an integration provider's stored fields onto AdapterEnv keys. */
const PROVIDER_TO_ENV: Record<string, (v: Vals) => Partial<AdapterEnv>> = {
  anthropic: (v) => ({ ANTHROPIC_API_KEY: v.apiKey }),
  openai: (v) => ({ OPENAI_API_KEY: v.apiKey }),
  gemini: (v) => ({ GEMINI_API_KEY: v.apiKey }),
  groq: (v) => ({ GROQ_API_KEY: v.apiKey }),
  openrouter: (v) => ({ OPENROUTER_API_KEY: v.apiKey }),
  nvidia: (v) => ({ NVIDIA_API_KEY: v.apiKey }),
  fal: (v) => ({ FAL_API_KEY: v.apiKey }),
  elevenlabs: (v) => ({ ELEVENLABS_API_KEY: v.apiKey }),
  ayrshare: (v) => ({ AYRSHARE_API_KEY: v.apiKey }),
  s3: (v) => ({
    S3_BUCKET: v.bucket,
    S3_REGION: v.region,
    S3_ENDPOINT: v.endpoint,
    S3_ACCESS_KEY_ID: v.accessKeyId,
    S3_SECRET_ACCESS_KEY: v.secretAccessKey,
  }),
  google_drive: (v) => ({
    GOOGLE_DRIVE_CLIENT_EMAIL: v.clientEmail,
    GOOGLE_DRIVE_PRIVATE_KEY: v.privateKey,
    GOOGLE_DRIVE_ROOT_FOLDER_ID: v.rootFolderId,
  }),
};

interface CipherRow {
  kind: string;
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

async function readOverlay(orgId: string): Promise<Partial<AdapterEnv>> {
  const rows = await withTenant(db, orgId, (tx) =>
    tx
      .select({
        kind: apiCredentials.kind,
        ciphertext: apiCredentials.ciphertext,
        iv: apiCredentials.iv,
        authTag: apiCredentials.authTag,
        dekWrapped: apiCredentials.dekWrapped,
        kekId: apiCredentials.kekId,
      })
      .from(apiCredentials)
      .where(like(apiCredentials.kind, `${PREFIX}%`)),
  );

  const overlay: Partial<AdapterEnv> = {};
  for (const row of rows) {
    const provider = row.kind.slice(PREFIX.length);
    const mapper = PROVIDER_TO_ENV[provider];
    if (!mapper) continue;
    try {
      const vals = JSON.parse(decryptSecretString(toEncrypted(row))) as Vals;
      for (const [k, val] of Object.entries(mapper(vals))) {
        if (val !== undefined && val !== '') (overlay as Record<string, unknown>)[k] = val;
      }
    } catch {
      // skip a credential that fails to decrypt/parse
    }
  }
  return overlay;
}

const cache = new Map<string, { adapters: Adapters; at: number }>();

export async function getOrgAdapters(orgId: string): Promise<Adapters> {
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.adapters;
  try {
    const overlay = await readOverlay(orgId);
    // No org-specific keys → use the default (env-built) adapters as-is.
    if (Object.keys(overlay).length === 0) {
      cache.set(orgId, { adapters: defaultAdapters, at: Date.now() });
      return defaultAdapters;
    }
    const merged = { ...(env as unknown as AdapterEnv), ...overlay };
    const built = createAdapters(merged);
    cache.set(orgId, { adapters: built, at: Date.now() });
    return built;
  } catch {
    // On any failure (DB/decrypt), fall back to the default adapters so jobs
    // still run rather than crash.
    return defaultAdapters;
  }
}

export function invalidateOrgAdapters(orgId: string): void {
  cache.delete(orgId);
}
