'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Flame, LogOut, Menu, Search, User } from 'lucide-react';
import { logout } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from './theme-toggle';
import { OrgSwitcher } from './org-switcher';
import { SidebarNav } from './sidebar-nav';
import { navSections } from './nav';
import { useMe, useNotifications } from '@/lib/hooks';
import { initials } from '@/lib/utils';

function currentTitle(pathname: string): string {
  for (const s of navSections) {
    for (const it of s.items) {
      if (pathname === it.href || pathname.startsWith(`${it.href}/`))
        return it.label;
    }
  }
  return 'MarketForge';
}

export function Topbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { data: me } = useMe();
  const { data: notifications } = useNotifications();
  const unread =
    notifications?.data.items.filter((n) => !n.read_at).length ?? 0;
  const user = me?.data.user;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="flex h-16 flex-row items-center gap-2 border-b border-border px-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flame className="h-4 w-4" />
            </span>
            <SheetTitle>MarketForge</SheetTitle>
          </SheetHeader>
          <div className="px-3 py-3">
            <OrgSwitcher />
          </div>
          <div className="px-3 pb-4">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <h1 className="text-sm font-semibold lg:hidden">
        {currentTitle(pathname)}
      </h1>

      {/* Search (desktop) */}
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search brands, campaigns, content…"
          className="pl-9"
          aria-label="Search"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Link href="/notifications">
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            ) : null}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              <Avatar>
                {user?.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user.full_name ?? ''} />
                ) : null}
                <AvatarFallback>
                  {initials(user?.full_name ?? user?.email ?? 'MF')}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="truncate font-medium text-foreground">
                  {user?.full_name ?? 'Operator'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email ?? 'dev@marketforge.local'}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="h-4 w-4" />
                Profile & settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
