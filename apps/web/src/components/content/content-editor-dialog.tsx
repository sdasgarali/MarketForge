'use client';

import * as React from 'react';
import { Clapperboard, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  useCreateContentItem,
  useGenerateVideoContent,
  useUpdateContentItem,
} from '@/lib/hooks';
import type { ContentItem, ContentType, Platform } from '@/lib/types';

const PLATFORMS: Platform[] = ['instagram', 'youtube', 'facebook', 'linkedin', 'x', 'tiktok'];
const CONTENT_TYPES: ContentType[] = [
  'post',
  'reel',
  'short',
  'thread',
  'carousel',
  'article',
  'story',
  'video',
];

function metaStr(item: ContentItem | null, key: string): string {
  const md = (item?.metadata ?? {}) as Record<string, unknown>;
  return typeof md[key] === 'string' ? (md[key] as string) : '';
}

/**
 * Create/edit a content item for a calendar cell — the operator's manual input
 * of Content, Characters, Story prompts + a manual "Generate Video" trigger.
 */
export function ContentEditorDialog({
  open,
  onOpenChange,
  item,
  brandId,
  defaults,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Existing item to edit; null → create mode. */
  item: ContentItem | null;
  /** Brand to attach new content to (create mode). */
  brandId?: string;
  /** Prefill for create mode (date + platform from the clicked cell). */
  defaults?: { scheduled_date?: string; platform?: Platform };
}) {
  const isEdit = !!item;
  const create = useCreateContentItem();
  const update = useUpdateContentItem();
  const genVideo = useGenerateVideoContent();

  const [platform, setPlatform] = React.useState<Platform>('instagram');
  const [contentType, setContentType] = React.useState<ContentType>('post');
  const [scheduledDate, setScheduledDate] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [caption, setCaption] = React.useState('');
  const [hashtags, setHashtags] = React.useState('');
  const [characters, setCharacters] = React.useState('');
  const [storyPrompt, setStoryPrompt] = React.useState('');
  const [imagePrompt, setImagePrompt] = React.useState('');

  // Reset the form whenever the dialog opens for a different item/cell.
  React.useEffect(() => {
    if (!open) return;
    setPlatform((item?.platform ?? defaults?.platform ?? 'instagram') as Platform);
    setContentType((item?.content_type ?? 'post') as ContentType);
    setScheduledDate(item?.scheduled_date ?? defaults?.scheduled_date ?? '');
    setTitle(item?.title ?? '');
    setBody(item?.body ?? '');
    setCaption(item?.caption ?? '');
    setHashtags((item?.hashtags ?? []).join(' '));
    setCharacters(metaStr(item, 'characters'));
    setStoryPrompt(metaStr(item, 'story_prompt'));
    setImagePrompt(metaStr(item, 'image_prompt'));
  }, [open, item, defaults?.platform, defaults?.scheduled_date]);

  const payload = () => ({
    platform,
    content_type: contentType,
    scheduled_date: scheduledDate || undefined,
    title: title || undefined,
    body: body || undefined,
    caption: caption || undefined,
    hashtags: hashtags
      .split(/[\s,]+/)
      .map((h) => h.replace(/^#/, ''))
      .filter(Boolean),
    characters: characters || undefined,
    story_prompt: storyPrompt || undefined,
    image_prompt: imagePrompt || undefined,
  });

  const save = async () => {
    if (isEdit && item) {
      await update.mutateAsync({ id: item.id, input: payload() });
    } else {
      if (!brandId) return;
      await create.mutateAsync({ brand_id: brandId, ...payload() });
    }
    onOpenChange(false);
  };

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit content' : 'New content'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Edit the topic, content, characters and prompts for this item.'
              : 'Manually add content to this calendar day. Fill what you know — AI can fill the rest.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched">Date</Label>
              <Input
                id="sched"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Topic / Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Content</Label>
            <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hashtags">Hashtags</Label>
              <Textarea
                id="hashtags"
                rows={2}
                placeholder="#launch #ai"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="characters">Characters</Label>
            <Textarea
              id="characters"
              rows={2}
              placeholder="Recurring characters / presets to feature"
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="story">Story prompt</Label>
              <Textarea
                id="story"
                rows={3}
                placeholder="Scene / narrative for the video"
                value={storyPrompt}
                onChange={(e) => setStoryPrompt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imgp">Image prompt</Label>
              <Textarea
                id="imgp"
                rows={3}
                placeholder="Visual direction for the poster/image"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit && item ? (
            <Button
              type="button"
              variant="outline"
              disabled={genVideo.isPending}
              onClick={() => genVideo.mutate({ id: item.id, duration_s: 10 })}
            >
              {genVideo.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clapperboard className="h-4 w-4" />
              )}
              Generate Video
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={busy || (!isEdit && !brandId)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save' : 'Add to calendar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
