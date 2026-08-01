'use client';

import * as React from 'react';
import { Plus, Wand2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/states';
import { FadeIn } from '@/components/common/motion';
import { ContentCalendar } from '@/components/content/content-calendar';
import { ContentEditorDialog } from '@/components/content/content-editor-dialog';
import { CalendarFillDialog } from '@/components/content/calendar-fill-dialog';
import { useBrands, useContentItems } from '@/lib/hooks';
import type { ContentItem } from '@/lib/types';

const ALL = '__all__';

/**
 * Self-contained calendar authoring surface: brand filter + New content +
 * Auto-fill + the month calendar + editor/fill dialogs. Used as the Dashboard
 * landing and reusable elsewhere.
 */
export function CalendarWorkspace() {
  const [brand, setBrand] = React.useState<string | undefined>(undefined);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContentItem | null>(null);
  const [createDate, setCreateDate] = React.useState<string | undefined>(undefined);
  const [fillOpen, setFillOpen] = React.useState(false);

  const { data, isLoading, isError, refetch } = useContentItems({ brand });
  const { data: brands } = useBrands();
  const items = data?.data.items ?? [];
  const editorBrandId = brand ?? brands?.data.items[0]?.id;

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={brand ?? ALL}
          onValueChange={(v) => setBrand(v === ALL ? undefined : v)}
        >
          <SelectTrigger className="w-44">
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

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFillOpen(true)} disabled={!editorBrandId}>
            <Wand2 className="h-4 w-4" />
            Auto-fill
          </Button>
          <Button size="sm" onClick={() => openCreate()} disabled={!editorBrandId}>
            <Plus className="h-4 w-4" />
            New content
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <FadeIn>
          <ContentCalendar items={items} onSelect={openEdit} onCreate={openCreate} />
        </FadeIn>
      )}

      <CalendarFillDialog
        open={fillOpen}
        onOpenChange={setFillOpen}
        brands={brands?.data.items ?? []}
        activeBrandId={brand}
      />
      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={editing}
        brandId={editorBrandId}
        defaults={{ scheduled_date: createDate }}
      />
    </div>
  );
}
