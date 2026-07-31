/**
 * publish processor — Stage 5. Consumed AFTER a human approves the content item
 * (the API sets status→approved/scheduled and schedules THIS publish job via the
 * backend-owned Scheduler, ADR-004). The worker loads the approved content +
 * media and publishes.
 *
 * Publishing runs entirely in the backend worker via `adapters.publisher`
 * (n8n retired — the platform owns the integration logic directly).
 *
 * On success: update publish_jobs (external id, url, published_at, status), set
 * content_item.status='published', enqueue delayed `analytics` (~1h). On failure:
 * rethrow so BullMQ retries; the base wrapper DLQ's + notifies on final attempt.
 *
 * NEXT STAGE: analytics (delayed).
 */
import { and, eq } from 'drizzle-orm';
import { adapters } from '@marketforge/adapters';
import { scheduler } from '@marketforge/queue';
import { db, withTenant, publishJobs, assets, socialAccounts } from '@marketforge/db';
import type { Platform } from '@marketforge/contracts';
import type { PublishMedia, PublishResult } from '@marketforge/adapters';
import { defineProcessor } from './base.js';
import { TerminalError } from '../lib/errors.js';
import { ANALYTICS_INITIAL_DELAY_MS } from '../lib/constants.js';
import { getBrand } from '../lib/brand.js';
import { getContentItem, setContentStatus } from '../lib/content.js';
import { writeAudit } from '../lib/audit.js';

interface PublishInputs {
  post: { text: string; title?: string; hashtags?: string[] };
  media: PublishMedia[];
  profileKey: string;
  publishJobId?: string;
}

export const publishProcessor = defineProcessor('publish', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id, content_item_id, platforms } = payload;

  // 1) Load approved content + media + resolve the brand's aggregator profile key.
  const inputs = await withTenant(db, org_id, async (tx): Promise<PublishInputs> => {
    const item = await getContentItem(tx, content_item_id);
    if (!item) throw new TerminalError(`content_item not found: ${content_item_id}`);
    // Guard: only publish content that a human approved / scheduled.
    if (!['approved', 'scheduled', 'publishing'].includes(item.status)) {
      throw new TerminalError(
        `content_item ${content_item_id} not approved for publish (status=${item.status})`,
      );
    }
    if (!item.brandId) throw new TerminalError('content_item missing brand_id');

    await setContentStatus(tx, content_item_id, 'publishing');

    // Media: ready image/video assets linked to the item.
    const assetRows = await tx
      .select()
      .from(assets)
      .where(and(eq(assets.contentItemId, content_item_id), eq(assets.status, 'ready')));
    const media: PublishMedia[] = assetRows
      .filter((a) => a.storageKey && (a.kind === 'image' || a.kind === 'video' || a.kind === 'gif'))
      .map((a) => ({ key: a.storageKey as string, kind: a.kind as 'image' | 'video' | 'gif' }));

    // Resolve per-brand profile key: payload override → social_account → brand.
    let profileKey = payload.profile_key ?? '';
    if (!profileKey && payload.social_account_id) {
      const sa = await tx
        .select({ profileKey: socialAccounts.profileKey })
        .from(socialAccounts)
        .where(eq(socialAccounts.id, payload.social_account_id))
        .limit(1);
      profileKey = sa[0]?.profileKey ?? '';
    }
    if (!profileKey) {
      const brand = await getBrand(tx, item.brandId);
      // Fall back to a brand-scoped key so the aggregator can route per brand.
      profileKey = brand ? `brand:${brand.id}` : `org:${org_id}`;
    }

    return {
      post: {
        text: item.caption || item.body || item.title || '',
        title: item.title ?? undefined,
        hashtags: item.hashtags ?? undefined,
      },
      media,
      profileKey,
      publishJobId: payload.publish_job_id,
    };
  });

  // 2) Publish via the publisher adapter (backend-owned; ADR-005 retired n8n).
  const results: PublishResult[] = await adapters.publisher.publish(
    inputs.post,
    platforms as Platform[],
    inputs.media,
    inputs.profileKey,
  );

  const anyFailed = results.some((r) => r.status === 'failed');
  const firstOk = results.find((r) => r.status === 'published');

  // 3) Persist results.
  await withTenant(db, org_id, async (tx) => {
    for (const r of results) {
      // Update or create the publish_jobs row per platform.
      const patch = {
        status: r.status === 'published' ? 'published' : 'failed',
        externalPostId: r.externalPostId ?? null,
        postUrl: r.postUrl ?? null,
        publishedAt: r.status === 'published' ? new Date() : null,
        error: r.error ? ({ message: r.error } as unknown) : null,
        updatedAt: new Date(),
      };
      if (inputs.publishJobId) {
        await tx.update(publishJobs).set(patch).where(eq(publishJobs.id, inputs.publishJobId));
      } else {
        await tx.insert(publishJobs).values({
          orgId: org_id,
          brandId: brand_id as string,
          contentItemId: content_item_id,
          socialAccountId: payload.social_account_id ?? null,
          platform: r.platform,
          ...patch,
        });
      }
    }

    if (!anyFailed) {
      await setContentStatus(tx, content_item_id, 'published');
    }
    await writeAudit(tx, org_id, {
      action: anyFailed ? 'content.publish_partial_failure' : 'content.published',
      entityType: 'content_item',
      entityId: content_item_id,
      after: { results } as unknown as never,
    });
  });

  // 4) If anything failed, throw so BullMQ retries (base wrapper DLQ's on final).
  if (anyFailed) {
    throw new Error(`publish failed for ${results.filter((r) => r.status === 'failed').map((r) => r.platform).join(', ')}`);
  }

  // 5) Schedule the first analytics pull (~1h) via the backend-owned Scheduler.
  await scheduler.scheduleIn(
    'analytics',
    {
      org_id,
      brand_id,
      campaign_id,
      content_item_id,
      publish_job_id: inputs.publishJobId,
      platform: firstOk?.platform,
      attempt_reason: 'initial',
    },
    ANALYTICS_INITIAL_DELAY_MS,
  );

  log.info({ content_item_id, platforms, external: firstOk?.externalPostId }, 'publish complete');
  return { published: true, results };
});
