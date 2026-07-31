/**
 * orchestrate processor — Pipeline 1 (AI 1). The operator's design:
 *   AI 1 checks the brand's contacts CSV in Google Drive.
 *     • If NEW contacts are available → activate Pipeline 2 (video generation).
 *     • Else → activate Pipeline 3 (market research → find a topic → content).
 *
 * "New" = CSV row count above the last-processed baseline stored on the brand.
 * When Drive/CSV isn't available we default to Pipeline 3 (research), matching
 * the "if not → Pipeline 3" branch. The decision is surfaced as a notification.
 */
import { eq } from 'drizzle-orm';
import { brands, db, withTenant } from '@marketforge/db';
import { enqueue } from '@marketforge/queue';
import { defineProcessor } from './base.js';
import { TerminalError } from '../lib/errors.js';
import { getBrand } from '../lib/brand.js';
import { getOrgDrive } from '../lib/org-drive.js';

/** Data rows in a CSV (excludes the header). */
function countCsvRows(csv: string): number {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

export const orchestrateProcessor = defineProcessor('orchestrate', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id, platform } = payload;
  if (!brand_id) throw new TerminalError('orchestrate requires brand_id');
  const plat = platform ?? 'instagram';

  const brand = await withTenant(db, org_id, (tx) => getBrand(tx, brand_id));
  const brandName = brand?.companyName ?? 'Brand';
  const kb = (brand?.knowledgeBase as { processedContacts?: number } | null) ?? {};
  const baseline = kb.processedContacts ?? 0;

  // --- AI 1: read the brand's contacts CSV from Drive + count contacts ---
  let totalContacts = 0;
  let csvFound = false;
  const drive = await getOrgDrive(org_id);
  if (drive) {
    try {
      const safe = brandName.replace(/'/g, "\\'");
      const files = await drive.findFiles(
        `trashed=false and name contains '${safe}' and (mimeType='text/csv' or name contains '.csv')`,
      );
      if (files[0]) {
        csvFound = true;
        const bytes = await drive.download(files[0].id);
        totalContacts = countCsvRows(bytes.toString('utf8'));
      }
    } catch (err) {
      log.warn({ err: String(err) }, 'orchestrate: CSV read failed — defaulting to research');
    }
  }

  const newContacts = Math.max(0, totalContacts - baseline);
  const activate = newContacts > 0 ? 2 : 3;

  // --- Branch ---
  if (activate === 2) {
    // Pipeline 2 — video generation for the new contact(s).
    await enqueue('generate-text', {
      org_id,
      brand_id,
      ...(campaign_id ? { campaign_id } : {}),
      platform: plat,
      content_type: 'video_script',
      language: 'en',
      attempt_reason: 'manual',
    });
    // Mark the contacts as processed (baseline = current total).
    await withTenant(db, org_id, (tx) =>
      tx
        .update(brands)
        .set({ knowledgeBase: { ...kb, processedContacts: totalContacts } as never, updatedAt: new Date() })
        .where(eq(brands.id, brand_id)),
    );
  } else {
    // Pipeline 3 — market research → find a suitable topic (chains to content).
    await enqueue('research', {
      org_id,
      brand_id,
      ...(campaign_id ? { campaign_id } : {}),
      platform: plat,
      attempt_reason: 'manual',
      topic: `Find a popular, appropriate social content topic for ${brandName}`,
    });
  }

  // Surface AI 1's decision (dashboard notification).
  await enqueue('notify', {
    org_id,
    brand_id,
    attempt_reason: 'manual',
    channel: 'dashboard',
    type: 'queue_status',
    title: `AI 1 checked ${brandName}`,
    body: csvFound
      ? `${totalContacts} contacts (${newContacts} new) → activating Pipeline ${activate} (${activate === 2 ? 'video' : 'research'})`
      : `No contacts CSV in Drive → activating Pipeline 3 (research)`,
  });

  log.info({ brand: brandName, csvFound, totalContacts, newContacts, activate }, 'AI 1 decision');
  return {
    brand: brandName,
    csv_found: csvFound,
    total_contacts: totalContacts,
    new_contacts: newContacts,
    activated_pipeline: activate,
  };
});
