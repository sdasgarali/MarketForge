'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { ErrorState } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { PlatformBadge } from '@/components/common/platform-badge';
import { FadeIn, Stagger, StaggerItem } from '@/components/common/motion';
import { AreaTrend } from '@/components/charts/area-trend';
import { SimpleBar } from '@/components/charts/simple-bar';
import { useAnalytics } from '@/lib/hooks';
import { chartColors, platformColor } from '@/lib/chart-palette';
import { Eye, Heart, TrendingUp, Users } from 'lucide-react';
import { formatCompact, formatNumber } from '@/lib/utils';

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useAnalytics('30d');

  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const a = data.data;
  const barData = a.by_platform.map((p) => ({
    platform: p.platform,
    impressions: p.impressions,
    reach: p.reach,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Cross-platform performance over the last 30 days."
        actions={<MockBadge show={data.isMock} />}
      />

      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Impressions',
            value: formatCompact(a.totals.impressions),
            icon: Eye,
            delta: 14,
          },
          {
            label: 'Engagement',
            value: formatCompact(a.totals.engagement),
            icon: Heart,
            delta: 9,
          },
          {
            label: 'Follower growth',
            value: `+${formatCompact(a.totals.followers_delta)}`,
            icon: Users,
            delta: 6,
          },
          {
            label: 'Posts published',
            value: formatNumber(a.totals.posts),
            icon: TrendingUp,
          },
        ].map((s) => (
          <StaggerItem key={s.label}>
            <StatCard {...s} />
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Impressions & engagement</CardTitle>
              <p className="text-sm text-muted-foreground">Daily, last 30 days</p>
            </CardHeader>
            <CardContent>
              <AreaTrend
                data={a.timeseries}
                xKey="date"
                formatX={(v) => v.slice(5)}
                height={280}
                series={[
                  {
                    key: 'impressions',
                    label: 'Impressions',
                    color: chartColors.primary,
                  },
                  {
                    key: 'engagement',
                    label: 'Engagement',
                    color: chartColors.cyan,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.08}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Reach by platform</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBar
                data={barData}
                xKey="platform"
                height={280}
                bars={[
                  {
                    key: 'impressions',
                    label: 'Impressions',
                    color: chartColors.primary,
                  },
                  { key: 'reach', label: 'Reach', color: chartColors.violet },
                ]}
              />
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Per-platform metrics</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Platform</th>
                    <th className="px-4 py-3 text-right font-medium">Posts</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Impressions
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Reach</th>
                    <th className="px-4 py-3 text-right font-medium">Likes</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Comments
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Clicks</th>
                    <th className="px-4 py-3 text-right font-medium">Eng. rate</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_platform.map((p) => (
                    <tr
                      key={p.platform}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-5 py-3">
                        <PlatformBadge platform={p.platform} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(p.posts)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(p.impressions)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(p.reach)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(p.likes)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(p.comments)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(p.clicks)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span style={{ color: platformColor[p.platform] }}>
                          {(p.engagement_rate * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
