'use client';

import * as React from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlatformIcon } from '@/components/common/platform-badge';
import { cn } from '@/lib/utils';
import { scoreTone } from '@/lib/display';
import type { ContentItem } from '@/lib/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Month calendar plotting scheduled/published content on their dates. */
export function ContentCalendar({
  items,
  onSelect,
}: {
  items: ContentItem[];
  onSelect: (item: ContentItem) => void;
}) {
  const [cursor, setCursor] = React.useState(new Date());

  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const dated = React.useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const it of items) {
      const d = it.scheduled_at ?? it.generated_at ?? it.created_at;
      if (!d) continue;
      const key = format(new Date(d), 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return map;
  }, [items]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="font-semibold">{format(cursor, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setCursor((c) => subMonths(c, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayItems = dated.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                'min-h-24 border-b border-r border-border/60 p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                !isSameMonth(day, cursor) && 'bg-muted/20',
              )}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday(day)
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : isSameMonth(day, cursor)
                        ? 'text-foreground'
                        : 'text-muted-foreground/50',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((it) => {
                  const tone =
                    it.quality_score !== undefined
                      ? scoreTone(it.quality_score)
                      : null;
                  return (
                    <button
                      key={it.id}
                      onClick={() => onSelect(it)}
                      className="flex w-full items-center gap-1 rounded bg-muted/70 px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-accent"
                      title={it.title}
                    >
                      <PlatformIcon
                        platform={it.platform}
                        className="h-3.5 w-3.5 text-[7px]"
                      />
                      <span className="truncate">{it.title}</span>
                      {tone ? (
                        <span
                          className={cn('ml-auto h-1.5 w-1.5 shrink-0 rounded-full', tone.bar)}
                        />
                      ) : null}
                    </button>
                  );
                })}
                {dayItems.length > 3 ? (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{dayItems.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
