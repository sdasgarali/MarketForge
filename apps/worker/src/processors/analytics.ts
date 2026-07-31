/**
 * analytics processor — Stage 6. Pulls post metrics from the publisher adapter,
 * upserts an `analytics` row, and reschedules a follow-up pull (~24h) up to
 * ANALYTICS_MAX_PULLS times.
 *
 * The pull count is derived from how many analytics rows already exist for the
 * content item — no extra state needed.
 *
 * NEXT STAGE: analytics (delayed follow-up) until the cap is reached.
 */
import { and, eq } from 'drizzle-orm';
import { adapters } from '@marketforge/adapters';
import { scheduler } from '@marketforge/queue';
import { db, withTenant, analytics, publishJobs } from '@marketforge/db';
import type { AnalyticsSnapshot } from '@marketforge/adapters';
import type { Platform } from '@marketforge/contracts';
import { defineProcessor } from './base.js';
import { TerminalError } from '../lib/errors.js';
import {
  ANALYTICS_FOLLOWUP_DELAY_MS,
  ANALYTICS_MAX_PULLS,
} from '../lib/constants.js';

export const analyticsProcessor = defineProcessor('analytics', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id, content_item_id, publish_job_id } = payload;

  // Resolve the external post id + platform + brand from the publish job.
  const ctx = await withTenant(db, org_id, async (tx) => {
    let externalPostId: string | undefined;
    let platform = payload.platform;
    let resolvedBrandId = brand_id;
    if (publish_job_id) {
      const rows = await tx
        .select({
          externalPostId: publishJobs.externalPostId,
          platform: publishJobs.platform,
          brandId: publishJobs.brandId,
        })
        .from(publishJobs)
        .where(eq(publishJobs.id, publish_job_id))
        .limit(1);
      externalPostId = rows[0]?.externalPostId ?? undefined;
      platform = (rows[0]?.platform as Platform | undefined) ?? platform;
      resolvedBrandId = rows[0]?.brandId ?? resolvedBrandId;
    }

    // Count prior pulls for this content item (to enforce the cap).
    let priorPulls = 0;
    if (content_item_id) {
      const rows = await tx
        .select({ id: analytics.id })
        .from(analytics)
        .where(and(eq(analytics.contentItemId, content_item_id)));
      priorPulls = rows.length;
    }
    return { externalPostId, platform, resolvedBrandId, priorPulls };
  });

  if (!ctx.platform) throw new TerminalError('analytics job could not resolve a platform');
  if (!ctx.resolvedBrandId) throw new TerminalError('analytics job could not resolve brand_id');

  // Fetch the snapshot via the publisher adapter (n8n retired).
  const profileKey = ctx.resolvedBrandId ? `brand:${ctx.resolvedBrandId}` : `org:${org_id}`;
  if (!ctx.externalPostId) throw new TerminalError('no external post id to fetch analytics for');
  const snap: AnalyticsSnapshot = await adapters.publisher.fetchAnalytics(
    ctx.externalPostId,
    ctx.platform as Platform,
    profileKey,
  );

  // Upsert the analytics row (append a new capture each pull for time-series).
  await withTenant(db, org_id, async (tx) => {
    await tx.insert(analytics).values({
      orgId: org_id,
      brandId: ctx.resolvedBrandId as string,
      contentItemId: content_item_id ?? null,
      publishJobId: publish_job_id ?? null,
      platform: ctx.platform as Platform,
      capturedAt: new Date(snap.capturedAt ?? new Date().toISOString()),
      views: snap.views ?? null,
      impressions: snap.impressions ?? null,
      likes: snap.likes ?? null,
      comments: snap.comments ?? null,
      shares: snap.shares ?? null,
      raw: (snap.raw ?? null) as unknown,
    });
  });

  // Reschedule a follow-up pull while under the cap (initial pull already counts
  // as priorPulls; after inserting this one, total = priorPulls + 1).
  const totalPulls = ctx.priorPulls + 1;
  if (totalPulls < ANALYTICS_MAX_PULLS) {
    await scheduler.scheduleIn(
      'analytics',
      {
        org_id,
        brand_id: ctx.resolvedBrandId,
        campaign_id,
        content_item_id,
        publish_job_id,
        platform: ctx.platform,
        attempt_reason: 'initial',
      },
      ANALYTICS_FOLLOWUP_DELAY_MS,
    );
    log.info({ content_item_id, totalPulls }, 'analytics captured; scheduled follow-up');
  } else {
    log.info({ content_item_id, totalPulls }, 'analytics captured; cap reached');
  }

  return { captured: true, totalPulls };
});
