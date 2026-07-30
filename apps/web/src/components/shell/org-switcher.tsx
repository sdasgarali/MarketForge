'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn, hueFromString, initials } from '@/lib/utils';
import { useMe } from '@/lib/hooks';
import { useUiStore } from '@/store/ui-store';

export function OrgSwitcher() {
  const { data } = useMe();
  const orgId = useUiStore((s) => s.orgId);
  const setOrgId = useUiStore((s) => s.setOrgId);

  const memberships = data?.data.memberships ?? [];
  const active =
    memberships.find((m) => m.org.id === orgId)?.org ??
    memberships[0]?.org ??
    data?.data.org;

  React.useEffect(() => {
    // Ensure the api-client + store agree on a valid org once /me resolves.
    if (active && active.id !== orgId) setOrgId(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  if (!active) {
    return (
      <div className="h-9 w-full animate-pulse rounded-md bg-muted" aria-hidden />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Switch organization"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{
              background: `hsl(${hueFromString(active.name)} 60% 45%)`,
            }}
          >
            {initials(active.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium leading-tight">
              {active.name}
            </span>
            <span className="block truncate text-xs capitalize text-muted-foreground">
              {active.plan} plan
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-64">
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.org.id}
            onSelect={() => setOrgId(m.org.id)}
            className="gap-2"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ background: `hsl(${hueFromString(m.org.name)} 60% 45%)` }}
            >
              {initials(m.org.name)}
            </span>
            <span className="flex-1 truncate">{m.org.name}</span>
            <Badge variant="muted" className="capitalize">
              {m.role}
            </Badge>
            <Check
              className={cn(
                'h-4 w-4',
                m.org.id === active.id ? 'opacity-100' : 'opacity-0',
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
