import type {
  BadgeProps,
} from '@/components/ui/badge';
import type {
  CampaignStatus,
  ContentStatus,
  NotificationType,
  Platform,
  TrustTier,
} from './types';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export const platformMeta: Record<
  Platform,
  { label: string; short: string; className: string }
> = {
  x: { label: 'X', short: 'X', className: 'bg-zinc-900 text-white' },
  instagram: {
    label: 'Instagram',
    short: 'IG',
    className: 'bg-gradient-to-br from-fuchsia-500 to-amber-400 text-white',
  },
  facebook: { label: 'Facebook', short: 'FB', className: 'bg-blue-600 text-white' },
  linkedin: {
    label: 'LinkedIn',
    short: 'in',
    className: 'bg-sky-700 text-white',
  },
  youtube: { label: 'YouTube', short: 'YT', className: 'bg-red-600 text-white' },
  tiktok: { label: 'TikTok', short: 'TT', className: 'bg-black text-white' },
};

export const contentStatusMeta: Record<
  ContentStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: 'Draft', variant: 'muted' },
  researching: { label: 'Researching', variant: 'secondary' },
  generating: { label: 'Generating', variant: 'secondary' },
  review: { label: 'In review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  scheduled: { label: 'Scheduled', variant: 'default' },
  publishing: { label: 'Publishing', variant: 'default' },
  published: { label: 'Published', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  needs_media: { label: 'Needs media', variant: 'warning' },
};

export const campaignStatusMeta: Record<
  CampaignStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: 'Draft', variant: 'muted' },
  queued: { label: 'Queued', variant: 'secondary' },
  running: { label: 'Running', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  done: { label: 'Done', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export const trustTierMeta: Record<
  TrustTier,
  { label: string; variant: BadgeVariant }
> = {
  new: { label: 'New', variant: 'muted' },
  reviewed: { label: 'Reviewed', variant: 'secondary' },
  trusted: { label: 'Trusted', variant: 'default' },
  auto: { label: 'Auto-publish', variant: 'success' },
};

export const notificationTypeMeta: Record<
  NotificationType,
  { variant: BadgeVariant; dot: string }
> = {
  success: { variant: 'success', dot: 'bg-success' },
  failure: { variant: 'destructive', dot: 'bg-destructive' },
  warning: { variant: 'warning', dot: 'bg-warning' },
  approval: { variant: 'default', dot: 'bg-primary' },
  queue_status: { variant: 'secondary', dot: 'bg-muted-foreground' },
};

/** Color band for a 0–100 AI score. */
export function scoreTone(score: number): {
  variant: BadgeVariant;
  text: string;
  bar: string;
} {
  if (score >= 90)
    return { variant: 'success', text: 'text-success', bar: 'bg-success' };
  if (score >= 80)
    return { variant: 'default', text: 'text-primary', bar: 'bg-primary' };
  if (score >= 70)
    return { variant: 'warning', text: 'text-warning', bar: 'bg-warning' };
  return { variant: 'destructive', text: 'text-destructive', bar: 'bg-destructive' };
}
