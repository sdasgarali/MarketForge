'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CampaignStatusBadge } from '@/components/common/status-badge';
import { PlatformIcon } from '@/components/common/platform-badge';
import { FadeIn } from '@/components/common/motion';
import { ContentTable } from '@/components/content/content-table';
import { ContentDetailDrawer } from '@/components/content/content-detail-drawer';
import {
  useBrands,
  useCampaign,
  useContentItems,
  useStartCampaign,
} from '@/lib/hooks';
import type { ContentItem } from '@/lib/types';

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data, isLoading, isError, refetch } = useCampaign(id);
  const content = useContentItems({ campaign: id });
  const { data: brands } = useBrands();
  const start = useStartCampaign();
  const [selected, setSelected] = React.useState<string | null>(null);

  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const c = data.data;
  const brandName = (bid: string) =>
    brands?.data.items.find((b) => b.id === bid)?.company_name ?? 'Brand';
  const items = content.data?.data.items ?? [];

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/campaigns')}
      >
        <ArrowLeft className="h-4 w-4" />
        Campaigns
      </Button>

      <PageHeader
        title={c.name}
        description={`${brandName(c.brand_id)}${c.topic ? ` · ${c.topic}` : ''}`}
        actions={
          <>
            <MockBadge show={data.isMock} />
            <CampaignStatusBadge status={c.status} />
            <Button
              disabled={
                start.isPending ||
                c.status === 'running' ||
                c.status === 'queued'
              }
              onClick={() => start.mutate(c.id)}
            >
              <Play className="h-4 w-4" />
              {c.status === 'running' ? 'Running' : 'Start campaign'}
            </Button>
          </>
        }
      />

      <FadeIn>
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-5 sm:grid-cols-4">
            <Meta label="Type">
              <Badge variant="muted" className="capitalize">
                {c.campaign_type.replace('_', ' ')}
              </Badge>
            </Meta>
            <Meta label="Platform">
              {c.platform ? (
                <span className="flex items-center gap-1.5">
                  <PlatformIcon platform={c.platform} />
                  <span className="capitalize">{c.platform}</span>
                </span>
              ) : (
                '—'
              )}
            </Meta>
            <Meta label="Priority">{c.priority}/10</Meta>
            <Meta label="Mode">{c.auto_mode ? 'Auto' : 'Manual'}</Meta>
            <Meta label="Approval">
              {c.approval_required ? 'Required' : 'Auto-publish'}
            </Meta>
            <Meta label="Language">{c.language.toUpperCase()}</Meta>
            <Meta label="Timezone">{c.timezone}</Meta>
            <Meta label="Created">
              {format(new Date(c.created_at), 'PP')}
            </Meta>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle>Content items</CardTitle>
          </CardHeader>
          <CardContent>
            {content.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : items.length === 0 ? (
              <EmptyState
                title="No content generated yet"
                description="Start the campaign to enqueue content generation."
              />
            ) : (
              <ContentTable
                items={items}
                brandName={brandName}
                onSelect={(i: ContentItem) => setSelected(i.id)}
              />
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <ContentDetailDrawer
        itemId={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
