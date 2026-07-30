'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone, Play } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CampaignStatusBadge } from '@/components/common/status-badge';
import { PlatformIcon } from '@/components/common/platform-badge';
import { Stagger, StaggerItem } from '@/components/common/motion';
import { CreateCampaignDialog } from '@/components/campaigns/create-campaign-dialog';
import { useBrands, useCampaigns, useStartCampaign } from '@/lib/hooks';

export default function CampaignsPage() {
  const { data, isLoading, isError, refetch } = useCampaigns();
  const { data: brands } = useBrands();
  const start = useStartCampaign();

  const brandName = (id: string) =>
    brands?.data.items.find((b) => b.id === id)?.company_name ?? 'Brand';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Content programs that run per brand — one-time launches to recurring drops."
        actions={
          <>
            <MockBadge show={data?.isMock} />
            <CreateCampaignDialog />
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.data.items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="No campaigns yet"
          description="Create a campaign to start generating content for a brand."
          action={<CreateCampaignDialog />}
        />
      ) : (
        <Stagger className="space-y-3">
          {data.data.items.map((c) => (
            <StaggerItem key={c.id}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center">
                  {c.platform ? <PlatformIcon platform={c.platform} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-semibold hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      <CampaignStatusBadge status={c.status} />
                      <Badge variant="muted" className="capitalize">
                        {c.campaign_type.replace('_', ' ')}
                      </Badge>
                      {c.auto_mode ? (
                        <Badge variant="secondary">Auto</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {brandName(c.brand_id)}
                      {c.topic ? ` · ${c.topic}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      Created{' '}
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/campaigns/${c.id}`}>View</Link>
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        start.isPending ||
                        c.status === 'running' ||
                        c.status === 'queued'
                      }
                      onClick={() => start.mutate(c.id)}
                    >
                      <Play className="h-4 w-4" />
                      {c.status === 'running' ? 'Running' : 'Start'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
