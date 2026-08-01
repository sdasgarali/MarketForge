/**
 * orchestrate processor — Pipeline 1 (AI 1). The operator's design:
 *   AI 1 checks the brand's contacts (in the DATABASE — no CSV).
 *     • If NEW contacts are available → activate Pipeline 2 (video generation).
 *     • Else → activate Pipeline 3 (market research → find a topic → content).
 *
 * "New" = contacts rows with status='new' for the brand. The decision is
 * surfaced as a dashboard notification. (CSV-in-Drive is intentionally NOT used;
 * all operational data lives in Postgres.)
 */
import { and, eq } from 'drizzle-orm';
import { contacts, db, withTenant } from '@marketforge/db';
import { enqueue } from '@marketforge/queue';
import { defineProcessor } from './base.js';
import { TerminalError } from '../lib/errors.js';
import { getBrand } from '../lib/brand.js';

export const orchestrateProcessor = defineProcessor('orchestrate', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id, platform } = payload;
  if (!brand_id) throw new TerminalError('orchestrate requires brand_id');
  const plat = platform ?? 'instagram';

  const brand = await withTenant(db, org_id, (tx) => getBrand(tx, brand_id));
  const brandName = brand?.companyName ?? 'Brand';

  // --- AI 1 checks for NEW contacts in the in-app contacts table (no CSV). ---
  const newRows = await withTenant(db, org_id, (tx) =>
    tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.brandId, brand_id), eq(contacts.status, 'new'))),
  );
  const newContacts = newRows.length;
  const source = newContacts > 0 ? 'contacts' : 'none';

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
    // Mark the in-app contacts processed so they aren't re-run.
    if (newRows.length) {
      await withTenant(db, org_id, (tx) =>
        tx
          .update(contacts)
          .set({ status: 'processed', updatedAt: new Date() })
          .where(and(eq(contacts.brandId, brand_id), eq(contacts.status, 'new'))),
      );
    }
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
    body:
      newContacts > 0
        ? `${newContacts} new contact${newContacts === 1 ? '' : 's'} (${source}) → activating Pipeline 2 (video)`
        : `No new contacts → activating Pipeline 3 (research)`,
  });

  log.info({ brand: brandName, source, newContacts, activate }, 'AI 1 decision');
  return {
    brand: brandName,
    source,
    new_contacts: newContacts,
    activated_pipeline: activate,
  };
});
