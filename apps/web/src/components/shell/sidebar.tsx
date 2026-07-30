'use client';

import Link from 'next/link';
import { Flame } from 'lucide-react';
import { OrgSwitcher } from './org-switcher';
import { SidebarNav } from './sidebar-nav';
import { useHealth } from '@/lib/hooks';
import { cn } from '@/lib/utils';

function HealthDot() {
  const { data } = useHealth();
  const status = data?.data.status ?? 'unknown';
  const ok = status === 'ok' || status === 'healthy';
  const mock = status === 'mock';
  return (
    <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          mock ? 'bg-warning' : ok ? 'bg-success' : 'bg-destructive',
        )}
      />
      {mock ? 'API offline · demo mode' : ok ? 'API connected' : 'API unreachable'}
    </div>
  );
}

/** Desktop sidebar. Hidden on mobile (replaced by a Sheet in the topbar). */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Flame className="h-4.5 w-4.5" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            MarketForge
          </span>
        </Link>
      </div>
      <div className="px-3 py-3">
        <OrgSwitcher />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <SidebarNav />
      </div>
      <div className="border-t border-sidebar-border py-3">
        <HealthDot />
      </div>
    </aside>
  );
}
