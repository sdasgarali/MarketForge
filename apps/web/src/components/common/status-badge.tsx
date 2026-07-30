import { Badge } from '@/components/ui/badge';
import {
  campaignStatusMeta,
  contentStatusMeta,
  trustTierMeta,
} from '@/lib/display';
import type { CampaignStatus, ContentStatus, TrustTier } from '@/lib/types';

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const m = contentStatusMeta[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const m = campaignStatusMeta[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function TrustTierBadge({ tier }: { tier: TrustTier }) {
  const m = trustTierMeta[tier];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
