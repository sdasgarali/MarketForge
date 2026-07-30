'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useBrands, useCreateCampaign } from '@/lib/hooks';
import { MVP_PLATFORMS } from '@/lib/types';
import type { CampaignType, Platform } from '@/lib/types';

const CAMPAIGN_TYPES: CampaignType[] = [
  'one_time',
  'recurring',
  'daily',
  'weekly',
  'monthly',
  'launch',
  'holiday',
  'emergency',
];

interface FormValues {
  name: string;
  brand_id: string;
  campaign_type: CampaignType;
  platform: Platform;
  topic: string;
  priority: number;
  auto_mode: boolean;
  approval_required: boolean;
}

export function CreateCampaignDialog() {
  const [open, setOpen] = React.useState(false);
  const { data: brands } = useBrands();
  const create = useCreateCampaign();
  const brandItems = brands?.data.items ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      brand_id: '',
      campaign_type: 'one_time',
      platform: 'instagram',
      topic: '',
      priority: 5,
      auto_mode: false,
      approval_required: true,
    },
  });

  const submit = handleSubmit((v) => {
    create.mutate(
      {
        name: v.name,
        brand_id: v.brand_id,
        campaign_type: v.campaign_type,
        platform: v.platform,
        topic: v.topic || undefined,
        priority: Number(v.priority),
        language: 'en',
        timezone: 'UTC',
        approval_required: v.approval_required,
        auto_mode: v.auto_mode,
      },
      {
        onSettled: () => {
          setOpen(false);
          reset();
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create campaign</DialogTitle>
          <DialogDescription>
            Campaigns generate content for a brand on a schedule.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="mb-1.5 block" htmlFor="c-name">
              Name
            </Label>
            <Input
              id="c-name"
              {...register('name', { required: 'Name is required' })}
              placeholder="Summer Glow Launch"
            />
            {errors.name ? (
              <p className="mt-1 text-xs text-destructive">
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Brand</Label>
              <Controller
                control={control}
                name="brand_id"
                rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandItems.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Platform</Label>
              <Controller
                control={control}
                name="platform"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MVP_PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Type</Label>
              <Controller
                control={control}
                name="campaign_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_TYPES.map((t) => (
                        <SelectItem
                          key={t}
                          value={t}
                          className="capitalize"
                        >
                          {t.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="c-priority">
                Priority (0–10)
              </Label>
              <Input
                id="c-priority"
                type="number"
                min={0}
                max={10}
                {...register('priority', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block" htmlFor="c-topic">
              Topic
            </Label>
            <Textarea
              id="c-topic"
              {...register('topic')}
              rows={2}
              placeholder="SPF 50 Fluid launch + UGC"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Require approval</p>
              <p className="text-xs text-muted-foreground">
                Human gate before publishing.
              </p>
            </div>
            <Controller
              control={control}
              name="approval_required"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Create campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
