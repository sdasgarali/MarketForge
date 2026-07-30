'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { Hash, RefreshCw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreRing, ScoreBar } from '@/components/common/score-ring';
import { ContentStatusBadge } from '@/components/common/status-badge';
import { PlatformBadge } from '@/components/common/platform-badge';
import { contentStatusMeta } from '@/lib/display';
import { useContentItem, useRegenerateContent } from '@/lib/hooks';
import type { ContentItem, ContentStatus } from '@/lib/types';

const LIFECYCLE: ContentStatus[] = [
  'draft',
  'researching',
  'generating',
  'review',
  'approved',
  'scheduled',
  'published',
];

export function ContentDetailDrawer({
  itemId,
  open,
  onOpenChange,
}: {
  itemId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading } = useContentItem(itemId ?? '');
  const regenerate = useRegenerateContent();

  const item = data?.data.item as ContentItem | undefined;
  const composite = data?.data.composite;
  const reviews = data?.data.reviews ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle>Content detail</SheetTitle>
        </SheetHeader>

        {isLoading || !item ? (
          <div className="space-y-4 p-5">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-6 p-5">
            <div className="flex items-center justify-between">
              <PlatformBadge platform={item.platform} />
              <ContentStatusBadge status={item.status} />
            </div>

            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt={item.title ?? ''}
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                No image generated yet
              </div>
            )}

            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {item.caption ?? item.body}
              </p>
              {item.hashtags.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.hashtags.map((h) => (
                    <Badge key={h} variant="secondary" className="gap-0.5">
                      <Hash className="h-3 w-3" />
                      {h.replace(/^#/, '')}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            {/* AI review breakdown */}
            {composite ? (
              <>
                <Separator />
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">AI review</p>
                      <p className="text-xs text-muted-foreground">
                        Threshold {composite.threshold} ·{' '}
                        {composite.passed ? 'passing' : 'below threshold'}
                      </p>
                    </div>
                    <ScoreRing score={composite.composite_score} />
                  </div>
                  <div className="space-y-2.5">
                    {reviews.map((r) => (
                      <div key={r.id}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="capitalize text-muted-foreground">
                            {r.stage}
                          </span>
                          <span className="tabular-nums">{r.score}</span>
                        </div>
                        <ScoreBar score={r.score} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {/* Status timeline */}
            <Separator />
            <div>
              <p className="mb-3 text-sm font-semibold">Status timeline</p>
              <ol className="relative space-y-3 border-l border-border pl-4">
                {LIFECYCLE.map((st) => {
                  const reached =
                    LIFECYCLE.indexOf(st) <= LIFECYCLE.indexOf(item.status);
                  const current = st === item.status;
                  return (
                    <li key={st} className="relative">
                      <span
                        className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 ${
                          current
                            ? 'border-primary bg-primary'
                            : reached
                              ? 'border-success bg-success'
                              : 'border-border bg-background'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          reached ? 'text-foreground' : 'text-muted-foreground/60'
                        }`}
                      >
                        {contentStatusMeta[st].label}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Generated{' '}
                {item.generated_at
                  ? formatDistanceToNow(new Date(item.generated_at), {
                      addSuffix: true,
                    })
                  : '—'}
                {item.scheduled_at
                  ? ` · scheduled ${format(new Date(item.scheduled_at), 'PP p')}`
                  : ''}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={regenerate.isPending}
                onClick={() => regenerate.mutate(item.id)}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
