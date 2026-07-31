import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  Megaphone,
  Settings,
  Sparkles,
  Workflow,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional badge key resolved from live data (e.g. approvals count). */
  badge?: 'approvals' | 'notifications';
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Brands', href: '/brands', icon: Sparkles },
      { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { label: 'Content', href: '/content', icon: CalendarDays },
      {
        label: 'Approvals',
        href: '/approvals',
        icon: CheckCircle2,
        badge: 'approvals',
      },
    ],
  },
  {
    title: 'Automation',
    items: [
      { label: 'Pipelines', href: '/pipelines', icon: Workflow },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      {
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        badge: 'notifications',
      },
    ],
  },
  {
    title: 'System',
    items: [{ label: 'Settings', href: '/settings', icon: Settings }],
  },
];
