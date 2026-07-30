/**
 * Dashboard service. Aggregates tenant-scoped counts + upcoming/recent activity
 * and a rough spend estimate from review-result costs (proxy for AI spend until
 * a dedicated ai_runs table exists). All reads via withTenant.
 */
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import {
  analytics,
  brands,
  campaigns,
  contentItems,
  db,
  notifications,
  publishJobs,
  reviewResults,
  withTenant,
} from '@marketforge/db';
import type { Platform } from '@marketforge/contracts';

export interface AnalyticsFilters {
  brandId?: string;
  platform?: Platform;
}

/** Number of days the analytics rollup covers (timeseries length). */
const ANALYTICS_WINDOW_DAYS = 30;

export const dashboardService = {
  async summary(orgId: string) {
    return withTenant(db, orgId, async (tx) => {
      // Counts grouped by content status.
      const statusRows = await tx
        .select({ status: contentItems.status, count: sql<number>`count(*)::int` })
        .from(contentItems)
        .groupBy(contentItems.status);
      const content_by_status: Record<string, number> = {};
      for (const r of statusRows) content_by_status[r.status] = Number(r.count);

      // Headline counts.
      const num = (rows: { c: number }[]) => Number(rows[0]?.c ?? 0);
      const brandsCount = num(
        await tx.select({ c: sql<number>`count(*)::int` }).from(brands),
      );
      const activeCampaigns = num(
        await tx
          .select({ c: sql<number>`count(*)::int` })
          .from(campaigns)
          .where(sql`${campaigns.status} in ('active','running','scheduled')`),
      );
      const pendingApprovals = num(
        await tx
          .select({ c: sql<number>`count(*)::int` })
          .from(contentItems)
          .where(eq(contentItems.status, 'review')),
      );
      const published30d = num(
        await tx
          .select({ c: sql<number>`count(*)::int` })
          .from(publishJobs)
          .where(
            sql`${publishJobs.status} = 'published' AND ${publishJobs.publishedAt} > now() - interval '30 days'`,
          ),
      );

      // Upcoming scheduled publishes — join for title + brand name.
      const upcoming = await tx
        .select({
          id: publishJobs.id,
          title: contentItems.title,
          platform: publishJobs.platform,
          brand_name: brands.companyName,
          scheduled_at: publishJobs.scheduledAt,
        })
        .from(publishJobs)
        .leftJoin(contentItems, eq(publishJobs.contentItemId, contentItems.id))
        .leftJoin(brands, eq(publishJobs.brandId, brands.id))
        .where(
          sql`${publishJobs.scheduledAt} > now() AND ${publishJobs.status} IN ('pending','publishing')`,
        )
        .orderBy(publishJobs.scheduledAt)
        .limit(10);

      // Recent successful publishes — join for title + brand name.
      const recent = await tx
        .select({
          id: publishJobs.id,
          title: contentItems.title,
          platform: publishJobs.platform,
          brand_name: brands.companyName,
          post_url: publishJobs.postUrl,
          published_at: publishJobs.publishedAt,
        })
        .from(publishJobs)
        .leftJoin(contentItems, eq(publishJobs.contentItemId, contentItems.id))
        .leftJoin(brands, eq(publishJobs.brandId, brands.id))
        .where(eq(publishJobs.status, 'published'))
        .orderBy(desc(publishJobs.publishedAt))
        .limit(10);

      // Spend proxy: review-result costs (AI QA spend) per day over last 30 days.
      const spendRows = await tx
        .select({
          day: sql<string>`to_char(date_trunc('day', ${reviewResults.createdAt}), 'YYYY-MM-DD')`,
          usd: sql<number>`coalesce(sum(${reviewResults.costUsd}), 0)::float`,
        })
        .from(reviewResults)
        .where(sql`${reviewResults.createdAt} > now() - interval '30 days'`)
        .groupBy(sql`date_trunc('day', ${reviewResults.createdAt})`);
      const spendByDay = new Map(spendRows.map((r) => [r.day, Number(r.usd)]));
      const spend_series: { date: string; usd: number }[] = [];
      let spend_usd_30d = 0;
      for (let i = 29; i >= 0; i--) {
        const dt = new Date();
        dt.setUTCDate(dt.getUTCDate() - i);
        const key = dt.toISOString().slice(0, 10);
        const usd = spendByDay.get(key) ?? 0;
        spend_usd_30d += usd;
        spend_series.push({ date: key, usd });
      }

      // Recent activity from notifications.
      const acts = await tx
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          body: notifications.body,
          created_at: notifications.createdAt,
        })
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(10);

      const nowIso = new Date().toISOString();
      return {
        content_by_status,
        counts: {
          brands: brandsCount,
          active_campaigns: activeCampaigns,
          pending_approvals: pendingApprovals,
          published_30d: published30d,
        },
        upcoming_scheduled: upcoming.map((u) => ({
          id: u.id,
          title: u.title ?? 'Untitled',
          platform: u.platform,
          brand_name: u.brand_name ?? '—',
          scheduled_at: u.scheduled_at?.toISOString() ?? nowIso,
        })),
        recent_publishes: recent.map((r) => ({
          id: r.id,
          title: r.title ?? 'Untitled',
          platform: r.platform,
          brand_name: r.brand_name ?? '—',
          published_at: r.published_at?.toISOString() ?? nowIso,
          post_url: r.post_url ?? undefined,
        })),
        spend_usd_30d,
        spend_series,
        activity: acts.map((a) => ({
          id: a.id,
          type: a.type ?? 'info',
          title: a.title ?? '',
          body: a.body ?? undefined,
          created_at: a.created_at?.toISOString() ?? nowIso,
        })),
      };
    });
  },

  /**
   * Aggregated analytics rollup (AnalyticsSummary) the web /analytics page reads:
   *   - by_platform: per-platform totals + post count + avg engagement rate
   *   - timeseries: daily impressions / engagement / clicks over the window
   *   - totals: headline impressions / engagement / follower growth / posts
   * Empty-safe: returns zeroed totals and a full zero-filled timeseries so the
   * charts always render even before any analytics rows exist.
   */
  async analytics(orgId: string, filters: AnalyticsFilters) {
    return withTenant(db, orgId, async (tx) => {
      const conds: SQL[] = [
        sql`${analytics.capturedAt} > now() - interval '${sql.raw(String(ANALYTICS_WINDOW_DAYS))} days'`,
      ];
      if (filters.brandId) conds.push(eq(analytics.brandId, filters.brandId));
      if (filters.platform) conds.push(eq(analytics.platform, filters.platform));
      const where = conds.length === 1 ? conds[0] : and(...conds);

      // Per-platform rollup. engagement = likes + comments + shares.
      const platformRows = await tx
        .select({
          platform: analytics.platform,
          impressions: sql<number>`coalesce(sum(${analytics.impressions}), 0)::float`,
          reach: sql<number>`coalesce(sum(${analytics.reach}), 0)::float`,
          likes: sql<number>`coalesce(sum(${analytics.likes}), 0)::float`,
          comments: sql<number>`coalesce(sum(${analytics.comments}), 0)::float`,
          shares: sql<number>`coalesce(sum(${analytics.shares}), 0)::float`,
          clicks: sql<number>`coalesce(sum(${analytics.clicks}), 0)::float`,
          followers_delta: sql<number>`coalesce(sum(${analytics.followersDelta}), 0)::float`,
          engagement_rate: sql<number>`coalesce(avg(${analytics.engagementRate}), 0)::float`,
          posts: sql<number>`count(distinct ${analytics.contentItemId})::int`,
        })
        .from(analytics)
        .where(where)
        .groupBy(analytics.platform);

      const by_platform = platformRows.map((p) => ({
        platform: (p.platform ?? 'x') as Platform,
        impressions: Number(p.impressions),
        reach: Number(p.reach),
        likes: Number(p.likes),
        comments: Number(p.comments),
        shares: Number(p.shares),
        clicks: Number(p.clicks),
        engagement_rate: Number(p.engagement_rate),
        posts: Number(p.posts),
      }));

      // Daily timeseries: impressions / engagement / clicks.
      const dayRows = await tx
        .select({
          day: sql<string>`to_char(date_trunc('day', ${analytics.capturedAt}), 'YYYY-MM-DD')`,
          impressions: sql<number>`coalesce(sum(${analytics.impressions}), 0)::float`,
          engagement: sql<number>`coalesce(sum(${analytics.likes} + ${analytics.comments} + ${analytics.shares}), 0)::float`,
          clicks: sql<number>`coalesce(sum(${analytics.clicks}), 0)::float`,
        })
        .from(analytics)
        .where(where)
        .groupBy(sql`date_trunc('day', ${analytics.capturedAt})`);
      const byDay = new Map(
        dayRows.map((r) => [
          r.day,
          {
            impressions: Number(r.impressions),
            engagement: Number(r.engagement),
            clicks: Number(r.clicks),
          },
        ]),
      );
      const timeseries: {
        date: string;
        impressions: number;
        engagement: number;
        clicks: number;
      }[] = [];
      for (let i = ANALYTICS_WINDOW_DAYS - 1; i >= 0; i--) {
        const dt = new Date();
        dt.setUTCDate(dt.getUTCDate() - i);
        const key = dt.toISOString().slice(0, 10);
        const d = byDay.get(key);
        timeseries.push({
          date: key,
          impressions: d?.impressions ?? 0,
          engagement: d?.engagement ?? 0,
          clicks: d?.clicks ?? 0,
        });
      }

      const totals = by_platform.reduce(
        (acc, p) => {
          acc.impressions += p.impressions;
          acc.engagement += p.likes + p.comments + p.shares;
          acc.posts += p.posts;
          return acc;
        },
        { impressions: 0, engagement: 0, followers_delta: 0, posts: 0 },
      );
      totals.followers_delta = platformRows.reduce(
        (a, p) => a + Number(p.followers_delta),
        0,
      );

      return { by_platform, timeseries, totals };
    });
  },
};
