'use client';

import { formatDistanceToNow } from 'date-fns';
import { Image as ImageIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContentStatusBadge } from '@/components/common/status-badge';
import { PlatformIcon } from '@/components/common/platform-badge';
import { scoreTone } from '@/lib/display';
import { cn } from '@/lib/utils';
import type { ContentItem } from '@/lib/types';

export function ContentTable({
  items,
  onSelect,
  brandName,
}: {
  items: ContentItem[];
  onSelect: (item: ContentItem) => void;
  brandName?: (brandId: string) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Content</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Brand
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Score
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const score = item.quality_score;
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          <PlatformIcon platform={item.platform} className="h-4 w-4 text-[8px]" />
                          {item.title ?? 'Untitled'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.caption ?? item.body}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {brandName ? brandName(item.brand_id) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ContentStatusBadge status={item.status} />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {score !== undefined ? (
                      <Badge variant={scoreTone(score).variant}>{score}</Badge>
                    ) : (
                      <span
                        className={cn('text-xs text-muted-foreground')}
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {formatDistanceToNow(
                      new Date(item.updated_at ?? item.created_at),
                      { addSuffix: true },
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
