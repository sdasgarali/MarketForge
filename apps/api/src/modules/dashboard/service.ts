/**
 * Dashboard service. Aggregates tenant-scoped counts + upcoming/recent activity
 * and a rough spend estimate from review-result costs (proxy for AI spend until
 * a dedicated ai_runs table exists). All reads via withTenant.
 */
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import {
  analytics,
  contentItems,
  db,
  publishJobs,
  reviewResults,
  withTenant,
} from '@marketforge/db';
import { analyticsToDto } from '../../lib/mappers.js';
import type { Platform } from '@marketforge/contracts';

export interface AnalyticsFilters {
  brandId?: string;
  platform?: Platform;
}

export const dashboardService = {
  async summary(orgId: string) {
    return withTenant(db, orgId, async (tx) => {
      // Counts grouped by content status.
      const statusRows = await tx
        .select({ status: contentItems.status, count: sql<number>`count(*)::int` })
        .from(contentItems)
        .groupBy(contentItems.status);
      const byStatus: Record<string, number> = {};
      for (const r of statusRows) byStatus[r.status] = Number(r.count);

      // Upcoming scheduled publishes (future scheduled_at, pending/publishing).
      const upcoming = await tx
        .select({
          id: publishJobs.id,
          content_item_id: publishJobs.contentItemId,
          platform: publishJobs.platform,
          scheduled_at: publishJobs.scheduledAt,
          status: publishJobs.status,
        })
        .from(publishJobs)
        .where(
          sql`${publishJobs.scheduledAt} > now() AND ${publishJobs.status} IN ('pending','publishing')`,
        )
        .orderBy(publishJobs.scheduledAt)
        .limit(10);

      // Recent successful publishes.
      const recent = await tx
        .select({
          id: publishJobs.id,
          content_item_id: publishJobs.contentItemId,
          platform: publishJobs.platform,
          post_url: publishJobs.postUrl,
          published_at: publishJobs.publishedAt,
        })
        .from(publishJobs)
        .where(eq(publishJobs.status, 'published'))
        .orderBy(desc(publishJobs.publishedAt))
        .limit(10);

      // Spend proxy: sum of review-result costs (AI QA spend recorded per run).
      const [{ spend } = { spend: 0 }] = await tx
        .select({ spend: sql<number>`coalesce(sum(${reviewResults.costUsd}), 0)::float` })
        .from(reviewResults);

      return {
        content_by_status: byStatus,
        upcoming_scheduled: upcoming.map((u) => ({
          ...u,
          scheduled_at: u.scheduled_at?.toISOString(),
        })),
        recent_publishes: recent.map((r) => ({
          ...r,
          published_at: r.published_at?.toISOString(),
        })),
        estimated_spend_usd: Number(spend),
      };
    });
  },

  async analytics(orgId: string, filters: AnalyticsFilters, limit: number, offset: number) {
    return withTenant(db, orgId, async (tx) => {
      const conds: SQL[] = [];
      if (filters.brandId) conds.push(eq(analytics.brandId, filters.brandId));
      if (filters.platform) conds.push(eq(analytics.platform, filters.platform));
      const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

      const base = tx.select().from(analytics).$dynamic();
      const rows = await (where ? base.where(where) : base)
        .orderBy(desc(analytics.capturedAt))
        .limit(limit)
        .offset(offset);
      return rows.map(analyticsToDto);
    });
  },
};
