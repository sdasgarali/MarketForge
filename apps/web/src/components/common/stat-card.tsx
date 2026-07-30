import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  delta?: number;
  hint?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              positive ? 'text-success' : 'text-destructive',
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta)}%
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </Card>
  );
}
