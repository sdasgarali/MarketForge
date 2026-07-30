'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { navSections } from './nav';
import { useApprovals, useNotifications } from '@/lib/hooks';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: approvals } = useApprovals();
  const { data: notifications } = useNotifications();

  const badgeCounts = {
    approvals: approvals?.data.items.length ?? 0,
    notifications:
      notifications?.data.items.filter((n) => !n.read_at).length ?? 0,
  };

  return (
    <nav className="flex flex-col gap-5" aria-label="Primary">
      {navSections.map((section, i) => (
        <div key={i} className="space-y-1">
          {section.title ? (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const count = item.badge ? badgeCounts[item.badge] : 0;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                ) : null}
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {count > 0 ? (
                  <Badge variant={active ? 'default' : 'muted'} className="px-1.5">
                    {count}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
