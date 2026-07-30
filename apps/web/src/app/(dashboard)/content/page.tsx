'use client';

import * as React from 'react';
import { CalendarDays, LayoutList } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { EmptyState, ErrorState } from '@/components/common/states';
import { FadeIn } from '@/components/common/motion';
import { ContentTable } from '@/components/content/content-table';
import { ContentCalendar } from '@/components/content/content-calendar';
import { ContentDetailDrawer } from '@/components/content/content-detail-drawer';
import {
  useBrands,
  useContentItems,
  type ContentFilters,
} from '@/lib/hooks';
import { MVP_PLATFORMS } from '@/lib/types';
import type { ContentStatus, Platform } from '@/lib/types';

const STATUSES: ContentStatus[] = [
  'draft',
  'generating',
  'review',
  'approved',
  'scheduled',
  'published',
  'needs_media',
  'failed',
];

const ALL = '__all__';

export default function ContentPage() {
  const [filters, setFilters] = React.useState<ContentFilters>({});
  const [selected, setSelected] = React.useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useContentItems(filters);
  const { data: brands } = useBrands();

  const brandName = (id: string) =>
    brands?.data.items.find((b) => b.id === id)?.company_name ?? 'Brand';
  const items = data?.data.items ?? [];

  const setFilter = (key: keyof ContentFilters, value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: value === ALL ? undefined : value,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Calendar and library of every generated post across your brands."
        actions={<MockBadge show={data?.isMock} />}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.brand ?? ALL}
          onValueChange={(v) => setFilter('brand', v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All brands</SelectItem>
            {brands?.data.items.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status ?? ALL}
          onValueChange={(v) => setFilter('status', v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.platform ?? ALL}
          onValueChange={(v) => setFilter('platform', v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All platforms</SelectItem>
            {MVP_PLATFORMS.map((p: Platform) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="table">
            <LayoutList className="h-4 w-4" />
            List
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <Skeleton className="mt-4 h-96 w-full" />
        ) : isError || !data ? (
          <div className="mt-4">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No content matches these filters"
              description="Adjust the filters or start a campaign to generate content."
            />
          </div>
        ) : (
          <>
            <TabsContent value="calendar">
              <FadeIn>
                <ContentCalendar
                  items={items}
                  onSelect={(i) => setSelected(i.id)}
                />
              </FadeIn>
            </TabsContent>
            <TabsContent value="table">
              <FadeIn>
                <ContentTable
                  items={items}
                  brandName={brandName}
                  onSelect={(i) => setSelected(i.id)}
                />
              </FadeIn>
            </TabsContent>
          </>
        )}
      </Tabs>

      <ContentDetailDrawer
        itemId={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}
