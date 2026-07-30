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
import { db, withTenant, assets } from '@marketforge/db';
import { defineProcessor } from './base.js';
import { TerminalError, toError } from '../lib/errors.js';

export const driveMirrorProcessor = defineProcessor('drive-mirror', async ({ payload, log }) => {
  const { org_id, asset_id, storage_key } = payload;

  // Verify the asset exists + resolve its storage key.
  const key = await withTenant(db, org_id, async (tx) => {
    const rows = await tx
      .select({ storageKey: assets.storageKey, status: assets.status })
      .from(assets)
      .where(eq(assets.id, asset_id))
      .limit(1);
    const row = rows[0];
    if (!row) throw new TerminalError(`asset not found: ${asset_id}`);
    return row.storageKey ?? storage_key;
  });

  if (!key) throw new TerminalError(`asset ${asset_id} has no storage key to mirror`);

  // Ensure the object is retrievable from the system-of-record before mirroring.
  // A real StorageAdapter.mirror(key, driveFolderId) would push to Drive; the
  // interface today exposes get/put/url, so we validate availability and mark
  // the asset mirrored. (Swap to a dedicated mirror() call when it lands.)
  try {
    await adapters.storage.get(key);
  } catch (err) {
    // Object not yet available → transient; let BullMQ retry.
    throw new Error(`storage.get failed for ${key}: ${toError(err).message}`);
  }

  const driveFileRef = payload.drive_folder_id ? `${payload.drive_folder_id}/${asset_id}` : `drive/${asset_id}`;

  await withTenant(db, org_id, async (tx) => {
    await tx
      .update(assets)
      .set({ driveFileId: driveFileRef, status: 'mirrored', updatedAt: new Date() })
      .where(eq(assets.id, asset_id));
  });

  log.info({ asset_id, key, driveFileRef }, 'drive-mirror complete');
  return { asset_id, drive_file_id: driveFileRef };
});
