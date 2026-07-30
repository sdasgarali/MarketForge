'use client';

import Link from 'next/link';
import { Globe, Plus, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { EmptyState, ErrorState } from '@/components/common/states';
import { TrustTierBadge } from '@/components/common/status-badge';
import { Stagger, StaggerItem } from '@/components/common/motion';
import { useBrands } from '@/lib/hooks';
import { hueFromString, initials } from '@/lib/utils';

export default function BrandsPage() {
  const { data, isLoading, isError, refetch } = useBrands();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands"
        description="Every brand you manage — voice, visual identity, and publishing rules."
        actions={
          <>
            <MockBadge show={data?.isMock} />
            <Button asChild>
              <Link href="/brands/new">
                <Plus className="h-4 w-4" />
                New brand
              </Link>
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-11 w-11 rounded-lg" />
              <Skeleton className="mt-4 h-5 w-32" />
              <Skeleton className="mt-2 h-4 w-24" />
              <Skeleton className="mt-4 h-4 w-full" />
            </Card>
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.data.items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No brands yet"
          description="Create your first brand to start generating on-brand content."
          action={
            <Button asChild>
              <Link href="/brands/new">
                <Plus className="h-4 w-4" />
                New brand
              </Link>
            </Button>
          }
        />
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.items.map((brand) => (
            <StaggerItem key={brand.id}>
              <Link href={`/brands/${brand.id}`} className="group block">
                <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{
                          background:
                            brand.brand_colors?.primary ??
                            `hsl(${hueFromString(brand.company_name)} 60% 45%)`,
                        }}
                      >
                        {initials(brand.company_name)}
                      </span>
                      <TrustTierBadge tier={brand.approval_settings.trust_tier} />
                    </div>
                    <h3 className="mt-4 font-semibold group-hover:text-primary">
                      {brand.company_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {brand.industry ?? 'No industry set'}
                    </p>
                    {brand.brand_voice ? (
                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {brand.brand_voice}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {brand.website ? (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {brand.website.replace(/^https?:\/\//, '')}
                        </span>
                      ) : null}
                      {brand.languages.slice(0, 3).map((l) => (
                        <Badge key={l} variant="muted" className="uppercase">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
