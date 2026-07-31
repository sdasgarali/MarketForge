'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Link2, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { ErrorState } from '@/components/common/states';
import { TrustTierBadge } from '@/components/common/status-badge';
import { PlatformIcon } from '@/components/common/platform-badge';
import { FadeIn } from '@/components/common/motion';
import { BrandForm } from '@/components/brands/brand-form';
import { useBrand, useSocialAccounts, useUpdateBrand } from '@/lib/hooks';
import { BrandKnowledge } from '@/components/brands/brand-knowledge';
import { hueFromString, initials } from '@/lib/utils';
import type { Brand } from '@/lib/types';

const connLabel: Record<string, string> = {
  connected: 'Connected',
  disconnected: 'Not connected',
  expired: 'Expired',
  error: 'Error',
};
const connVariant: Record<
  string,
  'success' | 'muted' | 'warning' | 'destructive'
> = {
  connected: 'success',
  disconnected: 'muted',
  expired: 'warning',
  error: 'destructive',
};

export default function BrandDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data, isLoading, isError, refetch } = useBrand(id);
  const social = useSocialAccounts(id);
  const update = useUpdateBrand(id);
  const [editOpen, setEditOpen] = React.useState(false);

  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const brand: Brand = data.data;
  const colors = brand.brand_colors ?? {};

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/brands')}>
        <ArrowLeft className="h-4 w-4" />
        Brands
      </Button>

      <PageHeader
        title={brand.company_name}
        description={brand.industry}
        actions={
          <>
            <MockBadge show={data.isMock} />
            <TrustTierBadge tier={brand.approval_settings.trust_tier} />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Voice & style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Detail label="Brand voice" value={brand.brand_voice} />
              <Detail label="Writing style" value={brand.writing_style} />
              <Detail label="Preferred CTA" value={brand.preferred_cta} />
              <Detail
                label="Negative prompt"
                value={brand.negative_prompt}
                mono
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offerings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TagList label="Products" items={brand.products} />
              <TagList label="Services" items={brand.services} />
              <TagList label="Competitors" items={brand.competitors} />
              <TagList label="Languages" items={brand.languages} upper />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.08} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-lg text-base font-bold text-white"
                  style={{
                    background:
                      colors.primary ??
                      `hsl(${hueFromString(brand.company_name)} 60% 45%)`,
                  }}
                >
                  {initials(brand.company_name)}
                </span>
                {brand.website ? (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {brand.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : null}
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Palette
                </p>
                <div className="flex gap-2">
                  {(['primary', 'secondary', 'accent'] as const).map((k) =>
                    colors[k] ? (
                      <div key={k} className="text-center">
                        <span
                          className="block h-9 w-9 rounded-md border border-border"
                          style={{ background: colors[k] }}
                        />
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {colors[k]}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
              <Detail label="Timezone" value={brand.timezone} />
              <Detail label="Image style" value={brand.image_style} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Social accounts</CardTitle>
              <Button variant="ghost" size="sm">
                <Plus className="h-4 w-4" />
                Connect
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {social.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : social.data && social.data.data.items.length > 0 ? (
                social.data.data.items.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 rounded-md border border-border p-2.5"
                  >
                    <PlatformIcon platform={acc.platform} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {acc.handle ?? acc.platform}
                      </p>
                    </div>
                    <Badge variant={connVariant[acc.connection_status]}>
                      {connLabel[acc.connection_status]}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  No accounts connected.
                </p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <BrandKnowledge brandId={id} />
      </FadeIn>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {brand.company_name}</DialogTitle>
          </DialogHeader>
          <BrandForm
            brand={brand}
            submitting={update.isPending}
            onSubmit={(input) =>
              update.mutate(input, { onSettled: () => setEditOpen(false) })
            }
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-muted-foreground/60">—</span>}
      </p>
    </div>
  );
}

function TagList({
  label,
  items,
  upper,
}: {
  label: string;
  items: string[];
  upper?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((t) => (
            <Badge key={t} variant="secondary" className={upper ? 'uppercase' : ''}>
              {t}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground/60">—</span>
      )}
    </div>
  );
}
