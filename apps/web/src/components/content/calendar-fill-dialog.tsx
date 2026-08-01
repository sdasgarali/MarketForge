'use client';

import * as React from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useFillCalendar } from '@/lib/hooks';
import type { Brand, Platform } from '@/lib/types';

const PLATFORMS: Platform[] = ['instagram', 'youtube', 'facebook', 'linkedin', 'x', 'tiktok'];

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Auto day-fill (operator plan §6): pick a date range, platforms and brands →
 * the backend plans a dated draft per day×platform and queues generation.
 */
export function CalendarFillDialog({
  open,
  onOpenChange,
  brands,
  activeBrandId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brands: Brand[];
  /** If a brand filter is active, default the fill to just that brand. */
  activeBrandId?: string;
}) {
  const fill = useFillCalendar();
  const [start, setStart] = React.useState(todayPlus(1));
  const [end, setEnd] = React.useState(todayPlus(7));
  const [platforms, setPlatforms] = React.useState<Platform[]>(['instagram']);
  const [perDay, setPerDay] = React.useState(1);
  const [brandIds, setBrandIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setBrandIds(activeBrandId ? [activeBrandId] : []);
  }, [open, activeBrandId]);

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const submit = async () => {
    await fill.mutateAsync({
      platforms,
      start_date: start,
      end_date: end,
      per_day_per_platform: perDay,
      ...(brandIds.length ? { brand_ids: brandIds } : {}),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Auto-fill the calendar</DialogTitle>
          <DialogDescription>
            Plan content across a date range. Each day × platform gets a draft, then AI writes it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">From</Label>
              <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">To</Label>
              <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatforms((l) => toggle(l, p))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs capitalize transition-colors',
                    platforms.includes(p)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Brands</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBrandIds([])}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  brandIds.length === 0
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                All brands
              </button>
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrandIds((l) => toggle(l, b.id))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    brandIds.includes(b.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {b.company_name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perday">Posts per day (per platform)</Label>
            <Input
              id="perday"
              type="number"
              min={1}
              max={10}
              value={perDay}
              onChange={(e) => setPerDay(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="w-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={fill.isPending || platforms.length === 0}>
            {fill.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Auto-fill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
