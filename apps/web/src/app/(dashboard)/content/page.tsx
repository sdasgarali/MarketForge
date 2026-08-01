'use client';

import * as React from 'react';
import { CalendarDays, LayoutList, Plus, Wand2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { EmptyState, ErrorState } from '@/components/common/states';
import { FadeIn } from '@/components/common/motion';
import { ContentTable } from '@/components/content/content-table';
import { ContentCalendar } from '@/components/content/content-calendar';
import { ContentDetailDrawer } from '@/components/content/content-detail-drawer';
import { ContentEditorDialog } from '@/components/content/content-editor-dialog';
import { CalendarFillDialog } from '@/components/content/calendar-fill-dialog';
import {
  useBrands,
  useContentItems,
  type ContentFilters,
} from '@/lib/hooks';
import { MVP_PLATFORMS } from '@/lib/types';
import type { ContentItem, ContentStatus, Platform } from '@/lib/types';

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
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContentItem | null>(null);
  const [createDate, setCreateDate] = React.useState<string | undefined>(undefined);
  const [fillOpen, setFillOpen] = React.useState(false);
  const { data, isLoading, isError, refetch } = useContentItems(filters);
  const { data: brands } = useBrands();

  const brandName = (id: string) =>
    brands?.data.items.find((b) => b.id === id)?.company_name ?? 'Brand';
  const items = data?.data.items ?? [];

  // Brand new content is attached to: the active brand filter, else the first brand.
  const editorBrandId = filters.brand ?? brands?.data.items[0]?.id;

  const openCreate = (dateStr?: string) => {
    setEditing(null);
    setCreateDate(dateStr);
    setEditorOpen(true);
  };
  const openEdit = (item: ContentItem) => {
    setEditing(item);
    setCreateDate(undefined);
    setEditorOpen(true);
  };

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
        actions={
          <div className="flex items-center gap-2">
            <MockBadge show={data?.isMock} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFillOpen(true)}
              disabled={!editorBrandId}
            >
              <Wand2 className="h-4 w-4" />
              Auto-fill
            </Button>
            <Button size="sm" onClick={() => openCreate()} disabled={!editorBrandId}>
              <Plus className="h-4 w-4" />
              New content
            </Button>
          </div>
        }
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
        ) : (
          <>
            <TabsContent value="calendar">
              <FadeIn>
                {/* Calendar always renders (even empty) so content can be authored. */}
                <ContentCalendar items={items} onSelect={openEdit} onCreate={openCreate} />
              </FadeIn>
            </TabsContent>
            <TabsContent value="table">
              <FadeIn>
                {items.length === 0 ? (
                  <EmptyState
                    title="No content matches these filters"
                    description="Add content to a calendar day, adjust filters, or start a campaign."
                  />
                ) : (
                  <ContentTable
                    items={items}
                    brandName={brandName}
                    onSelect={(i) => setSelected(i.id)}
                  />
                )}
              </FadeIn>
            </TabsContent>
          </>
        )}
      </Tabs>

      <CalendarFillDialog
        open={fillOpen}
        onOpenChange={setFillOpen}
        brands={brands?.data.items ?? []}
        activeBrandId={filters.brand}
      />

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={editing}
        brandId={editorBrandId}
        defaults={{
          scheduled_date: createDate,
          platform: filters.platform,
        }}
      />

      <ContentDetailDrawer
        itemId={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}
