'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { TagInput } from '@/components/common/tag-input';
import type { BrandCreateInput, Brand, TrustTier } from '@/lib/types';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
];

const TRUST_TIERS: TrustTier[] = ['new', 'reviewed', 'trusted', 'auto'];

interface BrandFormValues {
  company_name: string;
  website: string;
  industry: string;
  brand_voice: string;
  writing_style: string;
  preferred_cta: string;
  negative_prompt: string;
  image_style: string;
  video_style: string;
  mission: string;
  vision: string;
  timezone: string;
  languages: string[];
  products: string[];
  services: string[];
  competitors: string[];
  fonts: string[];
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  trust_tier: TrustTier;
  approval_mode: 'auto' | 'manual';
  min_score: number;
}

function toDefaults(brand?: Brand): BrandFormValues {
  return {
    company_name: brand?.company_name ?? '',
    website: brand?.website ?? '',
    industry: brand?.industry ?? '',
    brand_voice: brand?.brand_voice ?? '',
    writing_style: brand?.writing_style ?? '',
    preferred_cta: brand?.preferred_cta ?? '',
    negative_prompt: brand?.negative_prompt ?? '',
    image_style: brand?.image_style ?? '',
    video_style: brand?.video_style ?? '',
    mission: brand?.mission ?? '',
    vision: brand?.vision ?? '',
    timezone: brand?.timezone ?? 'UTC',
    languages: brand?.languages ?? ['en'],
    products: brand?.products ?? [],
    services: brand?.services ?? [],
    competitors: brand?.competitors ?? [],
    fonts: brand?.fonts ?? [],
    color_primary: brand?.brand_colors?.primary ?? '#7c6cf0',
    color_secondary: brand?.brand_colors?.secondary ?? '#18181b',
    color_accent: brand?.brand_colors?.accent ?? '#22d3ee',
    trust_tier: brand?.approval_settings?.trust_tier ?? 'new',
    approval_mode: brand?.approval_settings?.mode ?? 'manual',
    min_score: brand?.approval_settings?.min_score ?? 90,
  };
}

export function BrandForm({
  brand,
  submitting,
  onSubmit,
  onCancel,
}: {
  brand?: Brand;
  submitting?: boolean;
  onSubmit: (input: BrandCreateInput) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BrandFormValues>({ defaultValues: toDefaults(brand) });

  const submit = handleSubmit((v) => {
    const input: BrandCreateInput = {
      company_name: v.company_name,
      website: v.website || undefined,
      industry: v.industry || undefined,
      brand_voice: v.brand_voice || undefined,
      writing_style: v.writing_style || undefined,
      preferred_cta: v.preferred_cta || undefined,
      negative_prompt: v.negative_prompt || undefined,
      image_style: v.image_style || undefined,
      video_style: v.video_style || undefined,
      mission: v.mission || undefined,
      vision: v.vision || undefined,
      timezone: v.timezone,
      languages: v.languages,
      products: v.products,
      services: v.services,
      competitors: v.competitors,
      fonts: v.fonts,
      brand_colors: {
        primary: v.color_primary,
        secondary: v.color_secondary,
        accent: v.color_accent,
      },
      approval_settings: {
        mode: v.approval_mode,
        min_score: Number(v.min_score),
        trust_tier: v.trust_tier,
      },
    };
    onSubmit(input);
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <Tabs defaultValue="identity">
        <TabsList className="flex-wrap">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="voice">Voice & style</TabsTrigger>
          <TabsTrigger value="visual">Visual</TabsTrigger>
          <TabsTrigger value="publishing">Publishing</TabsTrigger>
        </TabsList>

        {/* IDENTITY */}
        <TabsContent value="identity">
          <Card>
            <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
              <Field label="Company name" error={errors.company_name?.message} required>
                <Input
                  {...register('company_name', {
                    required: 'Company name is required',
                  })}
                  placeholder="Aurora Skincare"
                />
              </Field>
              <Field label="Website">
                <Input {...register('website')} placeholder="https://…" />
              </Field>
              <Field label="Industry">
                <Input {...register('industry')} placeholder="Beauty & Personal Care" />
              </Field>
              <Field label="Timezone">
                <Controller
                  control={control}
                  name="timezone"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Mission" className="sm:col-span-2">
                <Textarea {...register('mission')} rows={2} />
              </Field>
              <Field label="Vision" className="sm:col-span-2">
                <Textarea {...register('vision')} rows={2} />
              </Field>
              <Field label="Products">
                <Controller
                  control={control}
                  name="products"
                  render={({ field }) => (
                    <TagInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Add product, press Enter"
                    />
                  )}
                />
              </Field>
              <Field label="Services">
                <Controller
                  control={control}
                  name="services"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} placeholder="Add service" />
                  )}
                />
              </Field>
              <Field label="Competitors" className="sm:col-span-2">
                <Controller
                  control={control}
                  name="competitors"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} placeholder="Add competitor" />
                  )}
                />
              </Field>
              <Field label="Languages">
                <Controller
                  control={control}
                  name="languages"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} placeholder="en, es…" />
                  )}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VOICE */}
        <TabsContent value="voice">
          <Card>
            <CardContent className="grid gap-5 pt-6">
              <Field label="Brand voice">
                <Textarea
                  {...register('brand_voice')}
                  rows={2}
                  placeholder="Warm, confident, dermatologist-precise. Never hypey."
                />
              </Field>
              <Field label="Writing style">
                <Textarea
                  {...register('writing_style')}
                  rows={2}
                  placeholder="Short sentences. Concrete claims. No exclamation spam."
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Preferred CTA">
                  <Input {...register('preferred_cta')} placeholder="Shop the routine" />
                </Field>
              </div>
              <Field label="Negative prompt (never generate)">
                <Textarea
                  {...register('negative_prompt')}
                  rows={2}
                  placeholder="no medical claims, no minors, no competitor names"
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VISUAL */}
        <TabsContent value="visual">
          <Card>
            <CardContent className="grid gap-5 pt-6">
              <div className="grid gap-5 sm:grid-cols-3">
                <ColorField label="Primary" {...register('color_primary')} />
                <ColorField label="Secondary" {...register('color_secondary')} />
                <ColorField label="Accent" {...register('color_accent')} />
              </div>
              <Field label="Fonts">
                <Controller
                  control={control}
                  name="fonts"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} placeholder="Inter, Fraunces…" />
                  )}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Image style">
                  <Textarea
                    {...register('image_style')}
                    rows={2}
                    placeholder="soft daylight, matte skin, pastel gradients"
                  />
                </Field>
                <Field label="Video style">
                  <Textarea
                    {...register('video_style')}
                    rows={2}
                    placeholder="slow product macro, ASMR texture"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PUBLISHING */}
        <TabsContent value="publishing">
          <Card>
            <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
              <Field label="Trust tier" hint="Controls auto-publish graduation.">
                <Controller
                  control={control}
                  name="trust_tier"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRUST_TIERS.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Approval mode">
                <Controller
                  control={control}
                  name="approval_mode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual approval</SelectItem>
                        <SelectItem value="auto">Auto (score-gated)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label="Minimum AI score to publish"
                hint="0–100 composite threshold."
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...register('min_score', { valueAsNumber: true })}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {brand ? 'Save changes' : 'Create brand'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 flex items-center gap-1">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

const ColorField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string }
>(({ label, ...props }, ref) => (
  <div>
    <Label className="mb-1.5 block">{label}</Label>
    <div className="flex items-center gap-2">
      <input
        ref={ref}
        type="color"
        {...props}
        className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
      />
    </div>
  </div>
));
ColorField.displayName = 'ColorField';
