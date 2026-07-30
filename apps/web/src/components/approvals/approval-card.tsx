'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Hash, RefreshCw, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScoreRing, ScoreBar } from '@/components/common/score-ring';
import { PlatformBadge } from '@/components/common/platform-badge';
import { scoreTone } from '@/lib/display';
import type { ApprovalItem } from '@/lib/types';

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  onRegenerate,
  busy,
}: {
  approval: ApprovalItem;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  busy?: boolean;
}) {
  const { content_item: item, composite, reviews, brand_name } = approval;

  return (
    <motion.div
      layout
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
    >
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[220px_1fr]">
          {/* Media */}
          <div className="relative bg-muted">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt={item.title ?? ''}
                className="h-48 w-full object-cover md:h-full"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center text-sm text-muted-foreground md:h-full">
                No image
              </div>
            )}
            <div className="absolute left-2 top-2">
              <Badge variant="secondary" className="backdrop-blur">
                {brand_name}
              </Badge>
            </div>
          </div>

          {/* Body */}
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <PlatformBadge platform={item.platform} />
                <h3 className="mt-1.5 font-semibold">{item.title}</h3>
              </div>
              <div className="shrink-0 text-center">
                <ScoreRing score={composite.composite_score} size={52} />
                <p className="mt-0.5 text-[10px] uppercase text-muted-foreground">
                  composite
                </p>
              </div>
            </div>

            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
              {item.caption ?? item.body}
            </p>

            {item.hashtags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.hashtags.slice(0, 6).map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center text-xs text-primary"
                  >
                    <Hash className="h-3 w-3" />
                    {h.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            ) : null}

            <Separator className="my-4" />

            {/* Per-check breakdown */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              {reviews.slice(0, 6).map((r) => (
                <Tooltip key={r.id}>
                  <TooltipTrigger asChild>
                    <div className="cursor-default">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="capitalize text-muted-foreground">
                          {r.stage}
                        </span>
                        <span className={scoreTone(r.score).text}>
                          {r.score}
                        </span>
                      </div>
                      <ScoreBar score={r.score} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {r.passed
                      ? `${r.stage} passed (${r.score})`
                      : `${r.stage}: below threshold`}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {composite.failed_stages.length ? (
              <p className="mt-3 text-xs text-warning">
                Flagged:{' '}
                {composite.failed_stages.map((s) => s).join(', ')}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={onApprove}
                disabled={busy}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onRegenerate}
                disabled={busy}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={onReject}
                disabled={busy}
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}

export { AnimatePresence };
