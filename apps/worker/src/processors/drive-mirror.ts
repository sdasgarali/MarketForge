/**
 * drive-mirror processor — Stage 8 (low priority). Mirrors a stored asset to the
 * per-brand Google Drive folder (ADR-006: S3 is system-of-record, Drive is a
 * rate-limited mirror). The storage adapter owns the actual S3→Drive copy; here
 * we fetch the object bytes (proving they exist) and record the mirror outcome
 * on the asset row.
 *
 * Drive's ~3 writes/s/account cap means this queue runs at low concurrency and
 * tolerates transient failures (BullMQ retries; final failure → DLQ).
 */
import { eq } from 'drizzle-orm';
import { adapters } from '@marketforge/adapters';
import { assets, contentItems, db, withTenant } from '@marketforge/db';
import { defineProcessor } from './base.js';
import { TerminalError, toError } from '../lib/errors.js';
import { getBrand } from '../lib/brand.js';
import { getOrgDrive } from '../lib/org-drive.js';
import { driveContentPath, safeSegment } from '../lib/drive-path.js';

const EXT: Record<string, string> = { image: 'png', video: 'mp4', gif: 'gif', audio: 'mp3' };

/** Compose the Topic + Content text file body from a content item. */
function buildTxt(ci: {
  title: string | null;
  body: string | null;
  caption: string | null;
  hashtags: string[] | null;
  platform: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`Topic: ${ci.title || 'Untitled'}`);
  if (ci.platform) lines.push(`Platform: ${ci.platform}`);
  lines.push('');
  if (ci.body) lines.push(ci.body);
  else if (ci.caption) lines.push(ci.caption);
  if (ci.hashtags?.length) {
    lines.push('');
    lines.push(ci.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '));
  }
  return lines.join('\n');
}

export const driveMirrorProcessor = defineProcessor('drive-mirror', async ({ payload, log }) => {
  const { org_id, asset_id, storage_key } = payload;

  // Load the asset + resolve the target brand + content item (for date/platform/topic).
  const meta = await withTenant(db, org_id, async (tx) => {
    const [row] = await tx
      .select({
        storageKey: assets.storageKey,
        kind: assets.kind,
        mimeType: assets.mimeType,
        brandId: assets.brandId,
        contentItemId: assets.contentItemId,
      })
      .from(assets)
      .where(eq(assets.id, asset_id))
      .limit(1);
    if (!row) throw new TerminalError(`asset not found: ${asset_id}`);
    const brand = await getBrand(tx, row.brandId ?? (payload.brand_id as string));
    let ci: {
      title: string | null;
      body: string | null;
      caption: string | null;
      hashtags: string[] | null;
      platform: string | null;
      contentType: string | null;
      createdAt: Date;
    } | null = null;
    if (row.contentItemId) {
      const [found] = await tx
        .select({
          title: contentItems.title,
          body: contentItems.body,
          caption: contentItems.caption,
          hashtags: contentItems.hashtags,
          platform: contentItems.platform,
          contentType: contentItems.contentType,
          createdAt: contentItems.createdAt,
        })
        .from(contentItems)
        .where(eq(contentItems.id, row.contentItemId))
        .limit(1);
      ci = found ?? null;
    }
    return {
      key: row.storageKey ?? storage_key,
      kind: row.kind,
      mimeType: row.mimeType,
      brandName: brand?.companyName ?? 'Brand',
      ci,
    };
  });

  if (!meta.key) throw new TerminalError(`asset ${asset_id} has no storage key to mirror`);

  // Fetch the bytes from the system-of-record (retryable if not yet available).
  let bytes: Buffer;
  try {
    bytes = await adapters.storage.get(meta.key);
  } catch (err) {
    throw new Error(`storage.get failed for ${meta.key}: ${toError(err).message}`);
  }

  // Upload to the org's Google Drive under the operator's File Structure:
  //   <Brand>/<Year>/<Month>/<Day>/<Platform>/<TypeSubfolder>/  (+ a <topic>.txt in <Platform>/).
  let driveFileRef: string;
  const drive = await getOrgDrive(org_id);
  if (drive) {
    const path = driveContentPath({
      brandName: meta.brandName,
      date: meta.ci?.createdAt ?? new Date(),
      platform: meta.ci?.platform,
      kind: meta.kind,
      contentType: meta.ci?.contentType,
    });
    const folderId = await drive.ensureFolderPath(path.folderParts);
    const ext = EXT[meta.kind] ?? 'bin';
    const file = await drive.uploadFile(
      `${meta.kind}-${asset_id.slice(0, 8)}.${ext}`,
      bytes,
      meta.mimeType ?? 'application/octet-stream',
      folderId,
    );
    driveFileRef = file.id;
    log.info(
      { asset_id, folder: path.folderParts.join('/'), driveFileId: file.id },
      'drive-mirror uploaded to Google Drive',
    );

    // Write the Topic + Content TXT into the Platform folder (once per content item).
    if (meta.ci) {
      try {
        const platformFolderId = await drive.ensureFolderPath(path.platformParts);
        const txtName = `${safeSegment(meta.ci.title || 'content')}.txt`;
        const existing = await drive.findFiles(
          `'${platformFolderId}' in parents and name='${txtName.replace(/'/g, "\\'")}' and trashed=false`,
        );
        if (!existing.length) {
          await drive.uploadFile(
            txtName,
            Buffer.from(buildTxt(meta.ci), 'utf8'),
            'text/plain; charset=utf-8',
            platformFolderId,
          );
        }
      } catch (err) {
        log.warn({ err: String(err) }, 'drive-mirror: TXT write failed (non-fatal)');
      }
    }
  } else {
    // No Drive configured → record a placeholder (S3 remains system of record).
    driveFileRef = `drive/${asset_id}`;
  }

  await withTenant(db, org_id, async (tx) => {
    await tx
      .update(assets)
      .set({ driveFileId: driveFileRef, status: 'mirrored', updatedAt: new Date() })
      .where(eq(assets.id, asset_id));
  });

  return { asset_id, drive_file_id: driveFileRef };
});
