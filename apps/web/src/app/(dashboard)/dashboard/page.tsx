'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  Megaphone,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { MockBadge } from '@/components/common/mock-banner';
import { ErrorState } from '@/components/common/states';
import { FadeIn, Stagger, StaggerItem } from '@/components/common/motion';
import { AreaTrend } from '@/components/charts/area-trend';
import { PlatformIcon } from '@/components/common/platform-badge';
import DashboardLoading from './loading';
import { useDashboard } from '@/lib/hooks';
import { chartColors } from '@/lib/chart-palette';
import { contentStatusMeta, notificationTypeMeta } from '@/lib/display';
import { cn, formatNumber, formatUsd } from '@/lib/utils';
import type { ContentStatus } from '@/lib/types';

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) return <DashboardLoading />;
  if (isError || !data)
    return (
      <ErrorState
        description="Could not load the dashboard summary."
        onRetry={() => refetch()}
      />
    );

  const d = data.data;
  const statusEntries = Object.entries(d.content_by_status) as [
    ContentStatus,
    number,
  ][];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Your marketing engine at a glance — pipeline, spend, and recent activity."
        actions={
          <>
            <MockBadge show={data.isMock} />
            <Button asChild>
              <Link href="/campaigns">
                <Megaphone className="h-4 w-4" />
                New campaign
              </Link>
            </Button>
          </>
        }
      />

      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Active brands',
            value: formatNumber(d.counts.brands),
            icon: Sparkles,
            hint: 'across the org',
          },
          {
            label: 'Active campaigns',
            value: formatNumber(d.counts.active_campaigns),
            icon: Megaphone,
            delta: 12,
          },
          {
            label: 'Pending approvals',
            value: formatNumber(d.counts.pending_approvals),
            icon: CheckCircle2,
            hint: 'awaiting review',
          },
          {
            label: 'Published (30d)',
            value: formatNumber(d.counts.published_30d),
            icon: Send,
            delta: 8,
          },
        ].map((s) => (
          <StaggerItem key={s.label}>
            <StatCard {...s} />
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Spend chart */}
        <FadeIn className="lg:col-span-2" delay={0.05}>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>AI & publishing spend</CardTitle>
                <p className="text-sm text-muted-foreground">Last 30 days</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-primary">
                <DollarSign className="h-4 w-4" />
                <span className="font-semibold tabular-nums">
                  {formatUsd(d.spend_usd_30d)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <AreaTrend
                data={d.spend_series}
                xKey="date"
                formatX={(v) => v.slice(5)}
                series={[
                  { key: 'usd', label: 'USD', color: chartColors.primary },
                ]}
              />
            </CardContent>
          </Card>
        </FadeIn>

        {/* Content pipeline */}
        <FadeIn delay={0.1}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Content pipeline</CardTitle>
              <p className="text-sm text-muted-foreground">By status</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusEntries
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const meta = contentStatusMeta[status];
                  const total = statusEntries.reduce((s, [, c]) => s + c, 0);
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming scheduled */}
        <FadeIn delay={0.05}>
          <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Upcoming
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/content">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {d.upcoming_scheduled.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing scheduled yet.
                </p>
              ) : (
                d.upcoming_scheduled.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <PlatformIcon platform={c.platform} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.brand_name}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.scheduled_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Recent publishes */}
        <FadeIn delay={0.1}>
          <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                Recent publishes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {d.recent_publishes.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <PlatformIcon platform={c.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.brand_name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c.published_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Activity feed */}
        <FadeIn delay={0.15}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {d.activity.slice(0, 6).map((a) => (
                <div key={a.id} className="flex gap-3">
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      notificationTypeMeta[a.type].dot,
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {a.title}
                    </p>
                    {a.body ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {a.body}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {formatDistanceToNow(new Date(a.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
