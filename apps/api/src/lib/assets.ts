/**
 * Asset URL resolution. The web ContentItem carries a convenience `image_url`
 * (resolved primary image) that isn't a column on content_items — it's derived
 * from the item's `assets` (kind=image). This helper turns an asset row into a
 * best-effort public URL:
 *   - a Drive file id → a Drive-hosted view URL (mirror copy, ADR-006), else
 *   - a storageKey that is already an absolute URL → used as-is, else
 *   - undefined (S3 object keys need a signed-URL/CDN layer we don't have here).
 */
import type { AssetRow } from '@marketforge/db';

function isAbsoluteUrl(v: string | null | undefined): v is string {
  return !!v && /^https?:\/\//i.test(v);
}

/** Resolve a public image URL for a single asset row, or undefined. */
export function assetImageUrl(a: Pick<AssetRow, 'driveFileId' | 'storageKey'>): string | undefined {
  if (a.driveFileId) {
    // Drive "uc?export=view" renders inline in an <img>.
    return `https://drive.google.com/uc?export=view&id=${a.driveFileId}`;
  }
  if (isAbsoluteUrl(a.storageKey)) return a.storageKey;
  return undefined;
}
